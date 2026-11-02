
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import (
    Board,
    BoardColumn,
    Task,
    User,
    Membership,
    ActivityLog,
)
from app.api.routes.auth import get_current_user
from app.api.routes.organizations import (
    require_tenant_access,
    require_tenant_manager,
)
from app.schemas.boards import (
    BoardCreate,
    BoardResponse,
    ColumnCreate,
    ColumnResponse,
    TaskCreate,
    TaskUpdate,
    TaskResponse,
)
from app.websockets.manager import manager


router = APIRouter(
    prefix="/api/organizations/{organization_id}/tenants/{tenant_id}",
    tags=["Kanban Boards"],
)


# -------------------------
# BOARD HELPERS
# -------------------------

def get_board_or_404(
    db: Session,
    organization_id: int,
    tenant_id: int,
    board_id: int,
):
    board = (
        db.query(Board)
        .filter(
            Board.id == board_id,
            Board.organization_id == organization_id,
            Board.tenant_id == tenant_id,
        )
        .first()
    )

    if not board:
        raise HTTPException(status_code=404, detail="Board not found.")

    return board


def validate_assignee(
    db: Session,
    user_id: int | None,
    organization_id: int,
    tenant_id: int,
):
    if user_id is None:
        return

    user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.is_active.is_(True),
        )
        .first()
    )

    if not user:
        raise HTTPException(status_code=404, detail="Assignee not found.")

    is_org_admin = (
        db.query(Membership)
        .filter(
            Membership.user_id == user_id,
            Membership.organization_id == organization_id,
            Membership.tenant_id.is_(None),
            Membership.role == "org_admin",
        )
        .first()
        is not None
    )

    is_tenant_member = (
        db.query(Membership)
        .filter(
            Membership.user_id == user_id,
            Membership.organization_id == organization_id,
            Membership.tenant_id == tenant_id,
        )
        .first()
        is not None
    )

    if not (is_org_admin or is_tenant_member):
        raise HTTPException(
            status_code=400,
            detail="Assignee must belong to this organization and tenant.",
        )


def add_activity(
    db: Session,
    organization_id: int,
    tenant_id: int,
    actor_id: int,
    entity_type: str,
    entity_id: int,
    action: str,
    details: dict | None = None,
):
    db.add(
        ActivityLog(
            organization_id=organization_id,
            tenant_id=tenant_id,
            actor_id=actor_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            details=details or {},
        )
    )


# -------------------------
# WEBSOCKET EVENT HELPER
# -------------------------

def broadcast_task_event(
    organization_id: int,
    tenant_id: int,
    board_id: int,
    event_type: str,
    task: Task | None = None,
    task_id: int | None = None,
    actor_id: int | None = None,
):
    """
    Broadcast a task event to users connected to the
    same organization, tenant, and board.
    """

    room = (
        f"org:{organization_id}:"
        f"tenant:{tenant_id}:"
        f"board:{board_id}"
    )

    message = {
        "type": event_type,
        "organization_id": organization_id,
        "tenant_id": tenant_id,
        "board_id": board_id,
        "actor_id": actor_id,
    }

    if task is not None:
        message["task"] = (
            TaskResponse.model_validate(task).model_dump(mode="json")
        )

    if task_id is not None:
        message["task_id"] = task_id

    manager.broadcast_sync(room, message)


# -------------------------
# BOARDS
# -------------------------

@router.post(
    "/boards",
    response_model=BoardResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_board(
    organization_id: int,
    tenant_id: int,
    data: BoardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_tenant_manager(
        db, current_user.id, organization_id, tenant_id
    )

    board = Board(
        organization_id=organization_id,
        tenant_id=tenant_id,
        name=data.name.strip(),
        description=data.description,
        created_by=current_user.id,
    )

    db.add(board)
    db.flush()

    default_columns = [
        BoardColumn(
            tenant_id=tenant_id,
            board_id=board.id,
            name="To Do",
            position=1000,
        ),
        BoardColumn(
            tenant_id=tenant_id,
            board_id=board.id,
            name="In Progress",
            position=2000,
        ),
        BoardColumn(
            tenant_id=tenant_id,
            board_id=board.id,
            name="Done",
            position=3000,
        ),
    ]

    db.add_all(default_columns)

    add_activity(
        db,
        organization_id,
        tenant_id,
        current_user.id,
        "board",
        board.id,
        "created",
        {"name": board.name},
    )

    db.commit()
    db.refresh(board)

    return board


@router.get("/boards", response_model=list[BoardResponse])
def list_boards(
    organization_id: int,
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_tenant_access(
        db, current_user.id, organization_id, tenant_id
    )

    return (
        db.query(Board)
        .filter(
            Board.organization_id == organization_id,
            Board.tenant_id == tenant_id,
        )
        .order_by(Board.id.desc())
        .all()
    )


@router.get("/boards/{board_id}", response_model=BoardResponse)
def get_board(
    organization_id: int,
    tenant_id: int,
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_tenant_access(
        db, current_user.id, organization_id, tenant_id
    )

    return get_board_or_404(
        db, organization_id, tenant_id, board_id
    )


# -------------------------
# COLUMNS
# -------------------------

@router.post(
    "/boards/{board_id}/columns",
    response_model=ColumnResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_column(
    organization_id: int,
    tenant_id: int,
    board_id: int,
    data: ColumnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_tenant_manager(
        db, current_user.id, organization_id, tenant_id
    )

    get_board_or_404(db, organization_id, tenant_id, board_id)

    column = BoardColumn(
        tenant_id=tenant_id,
        board_id=board_id,
        name=data.name.strip(),
        position=data.position,
    )

    db.add(column)
    db.commit()
    db.refresh(column)

    return column


@router.get(
    "/boards/{board_id}/columns",
    response_model=list[ColumnResponse],
)
def list_columns(
    organization_id: int,
    tenant_id: int,
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_tenant_access(
        db, current_user.id, organization_id, tenant_id
    )

    get_board_or_404(db, organization_id, tenant_id, board_id)

    return (
        db.query(BoardColumn)
        .filter(
            BoardColumn.tenant_id == tenant_id,
            BoardColumn.board_id == board_id,
        )
        .order_by(BoardColumn.position, BoardColumn.id)
        .all()
    )


# -------------------------
# TASKS
# -------------------------

@router.post(
    "/boards/{board_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    organization_id: int,
    tenant_id: int,
    board_id: int,
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_tenant_access(
        db, current_user.id, organization_id, tenant_id
    )

    get_board_or_404(db, organization_id, tenant_id, board_id)

    column = (
        db.query(BoardColumn)
        .filter(
            BoardColumn.id == data.column_id,
            BoardColumn.tenant_id == tenant_id,
            BoardColumn.board_id == board_id,
        )
        .first()
    )

    if not column:
        raise HTTPException(
            status_code=400,
            detail="The selected column does not belong to this board.",
        )

    validate_assignee(
        db, data.assigned_to, organization_id, tenant_id
    )

    task = Task(
        tenant_id=tenant_id,
        board_id=board_id,
        column_id=data.column_id,
        title=data.title.strip(),
        description=data.description,
        priority=data.priority,
        position=data.position,
        assigned_to=data.assigned_to,
    )

    db.add(task)
    db.flush()

    add_activity(
        db,
        organization_id,
        tenant_id,
        current_user.id,
        "task",
        task.id,
        "created",
        {"title": task.title},
    )

    db.commit()
    db.refresh(task)

    broadcast_task_event(
        organization_id=organization_id,
        tenant_id=tenant_id,
        board_id=board_id,
        event_type="task_created",
        task=task,
        actor_id=current_user.id,
    )

    return task


@router.get(
    "/boards/{board_id}/tasks",
    response_model=list[TaskResponse],
)
def list_tasks(
    organization_id: int,
    tenant_id: int,
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_tenant_access(
        db, current_user.id, organization_id, tenant_id
    )

    get_board_or_404(db, organization_id, tenant_id, board_id)

    return (
        db.query(Task)
        .filter(
            Task.tenant_id == tenant_id,
            Task.board_id == board_id,
        )
        .order_by(Task.column_id, Task.position, Task.id)
        .all()
    )


@router.patch(
    "/boards/{board_id}/tasks/{task_id}",
    response_model=TaskResponse,
)
def update_task(
    organization_id: int,
    tenant_id: int,
    board_id: int,
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_tenant_access(
        db, current_user.id, organization_id, tenant_id
    )

    get_board_or_404(db, organization_id, tenant_id, board_id)

    task = (
        db.query(Task)
        .filter(
            Task.id == task_id,
            Task.tenant_id == tenant_id,
            Task.board_id == board_id,
        )
        .first()
    )

    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    if task.version != data.version:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Task was changed by another user. Refresh and try again.",
                "current_version": task.version,
            },
        )

    changes = data.model_dump(exclude_unset=True)
    changes.pop("version", None)

    if not changes:
        raise HTTPException(
            status_code=400,
            detail="No task changes were provided.",
        )

    for field in ("title", "priority", "column_id", "position"):
        if field in changes and changes[field] is None:
            raise HTTPException(
                status_code=422,
                detail=f"{field} cannot be null.",
            )

    if "title" in changes:
        changes["title"] = changes["title"].strip()

    if "column_id" in changes:
        target_column = (
            db.query(BoardColumn)
            .filter(
                BoardColumn.id == changes["column_id"],
                BoardColumn.tenant_id == tenant_id,
                BoardColumn.board_id == board_id,
            )
            .first()
        )

        if not target_column:
            raise HTTPException(
                status_code=400,
                detail="Target column does not belong to this board.",
            )

    if "assigned_to" in changes:
        validate_assignee(
            db,
            changes["assigned_to"],
            organization_id,
            tenant_id,
        )

    changes["version"] = Task.version + 1
    changes["updated_at"] = datetime.now(timezone.utc)

    result = db.execute(
        update(Task)
        .where(
            Task.id == task_id,
            Task.tenant_id == tenant_id,
            Task.board_id == board_id,
            Task.version == data.version,
        )
        .values(**changes)
    )

    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Task was changed by another user. Refresh and try again.",
        )

    add_activity(
        db,
        organization_id,
        tenant_id,
        current_user.id,
        "task",
        task_id,
        "updated",
        {"changed_fields": list(changes.keys())},
    )

    db.commit()

    updated_task = (
        db.query(Task)
        .filter(
            Task.id == task_id,
            Task.tenant_id == tenant_id,
            Task.board_id == board_id,
        )
        .first()
    )

    if updated_task is not None:
        broadcast_task_event(
            organization_id=organization_id,
            tenant_id=tenant_id,
            board_id=board_id,
            event_type="task_updated",
            task=updated_task,
            actor_id=current_user.id,
        )

    return updated_task


@router.delete(
    "/boards/{board_id}/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_task(
    organization_id: int,
    tenant_id: int,
    board_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_tenant_access(
        db, current_user.id, organization_id, tenant_id
    )

    get_board_or_404(db, organization_id, tenant_id, board_id)

    task = (
        db.query(Task)
        .filter(
            Task.id == task_id,
            Task.tenant_id == tenant_id,
            Task.board_id == board_id,
        )
        .first()
    )

    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    add_activity(
        db,
        organization_id,
        tenant_id,
        current_user.id,
        "task",
        task.id,
        "deleted",
        {"title": task.title},
    )

    deleted_task_id = task.id

    db.delete(task)
    db.commit()

    broadcast_task_event(
        organization_id=organization_id,
        tenant_id=tenant_id,
        board_id=board_id,
        event_type="task_deleted",
        task_id=deleted_task_id,
        actor_id=current_user.id,
    )

    return None

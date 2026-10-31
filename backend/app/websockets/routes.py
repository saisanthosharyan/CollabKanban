import jwt

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select, or_

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import User, Membership, Board

from app.websockets.manager import manager


router = APIRouter()


@router.websocket(
    "/ws/organizations/{organization_id}/tenants/{tenant_id}/boards/{board_id}"
)
async def board_websocket(
    websocket: WebSocket,
    organization_id: int,
    tenant_id: int,
    board_id: int,
    token: str,
):
    db = SessionLocal()
    room = f"org:{organization_id}:tenant:{tenant_id}:board:{board_id}"

    try:
        # 1. Verify JWT.
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
            user_id = int(payload["sub"])
        except Exception:
            await websocket.close(code=1008, reason="Invalid or expired token")
            return

        # 2. Verify user exists.
        user = db.get(User, user_id)

        if not user:
            await websocket.close(code=1008, reason="User not found")
            return

        # 3. Verify board belongs to the requested organization and tenant.
        board = db.scalar(
            select(Board).where(
                Board.id == board_id,
                Board.organization_id == organization_id,
                Board.tenant_id == tenant_id,
            )
        )

        if not board:
            await websocket.close(code=1008, reason="Board access denied")
            return

        # 4. Verify tenant membership or organization-admin membership.
        membership = db.scalar(
            select(Membership).where(
                Membership.user_id == user_id,
                Membership.organization_id == organization_id,
                or_(
                    Membership.tenant_id == tenant_id,
                    Membership.tenant_id.is_(None),
                ),
            )
        )

        if not membership:
            await websocket.close(code=1008, reason="Tenant access denied")
            return

        # 5. Connect user to the authorized board room.
        await manager.connect(room, websocket)

        await manager.broadcast(
            room,
            {
                "type": "user_connected",
                "user_id": user_id,
                "user_name": user.name,
                "board_id": board_id,
                "message": f"{user.name} joined the board",
            },
        )

        # 6. Keep connection alive and receive client messages.
        while True:
            data = await websocket.receive_json()

            # Clients can send a ping to check connection health.
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        await manager.disconnect(room, websocket)

        await manager.broadcast(
            room,
            {
                "type": "user_disconnected",
                "message": "A user left the board",
                "board_id": board_id,
            },
        )

    except Exception:
        await manager.disconnect(room, websocket)

    finally:
        db.close()
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Organization, Tenant, User, Membership
from app.api.routes.auth import get_current_user
from app.schemas.organizations import (
    OrganizationCreate,
    OrganizationResponse,
    TenantCreate,
    TenantResponse,
    AddTenantMemberRequest,
    TenantMemberResponse,
)

router = APIRouter(prefix="/api/organizations", tags=["Organizations"])


def make_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "workspace"


def is_org_admin(db: Session, user_id: int, organization_id: int) -> bool:
    return (
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


def require_org_access(db: Session, user_id: int, organization_id: int):
    membership = (
        db.query(Membership)
        .filter(
            Membership.user_id == user_id,
            Membership.organization_id == organization_id,
        )
        .first()
    )

    if not membership:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this organization.",
        )


def require_tenant_access(
    db: Session,
    user_id: int,
    organization_id: int,
    tenant_id: int,
):
    if is_org_admin(db, user_id, organization_id):
        return "org_admin"

    membership = (
        db.query(Membership)
        .filter(
            Membership.user_id == user_id,
            Membership.organization_id == organization_id,
            Membership.tenant_id == tenant_id,
        )
        .first()
    )

    if not membership:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this tenant.",
        )

    return membership.role


def require_tenant_manager(
    db: Session,
    user_id: int,
    organization_id: int,
    tenant_id: int,
):
    role = require_tenant_access(
        db, user_id, organization_id, tenant_id
    )

    if role not in ("org_admin", "tenant_admin"):
        raise HTTPException(
            status_code=403,
            detail="Tenant Admin or Organization Admin permission required.",
        )


@router.post(
    "",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_organization(
    data: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_slug = make_slug(data.name)
    slug = base_slug
    suffix = 2

    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    organization = Organization(
        name=data.name.strip(),
        slug=slug,
    )

    db.add(organization)
    db.flush()

    membership = Membership(
        user_id=current_user.id,
        organization_id=organization.id,
        tenant_id=None,
        role="org_admin",
    )

    db.add(membership)
    db.commit()
    db.refresh(organization)

    return organization


@router.get("", response_model=list[OrganizationResponse])
def list_organizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Organization)
        .join(
            Membership,
            Membership.organization_id == Organization.id,
        )
        .filter(Membership.user_id == current_user.id)
        .distinct()
        .all()
    )


@router.get("/{organization_id}", response_model=OrganizationResponse)
def get_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_org_access(db, current_user.id, organization_id)

    organization = db.query(Organization).filter(
        Organization.id == organization_id
    ).first()

    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found.")

    return organization


@router.post(
    "/{organization_id}/tenants",
    response_model=TenantResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_tenant(
    organization_id: int,
    data: TenantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_org_admin(db, current_user.id, organization_id):
        raise HTTPException(
            status_code=403,
            detail="Only an Organization Admin can create tenants.",
        )

    organization = db.query(Organization).filter(
        Organization.id == organization_id
    ).first()

    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found.")

    base_slug = make_slug(data.name)
    slug = base_slug
    suffix = 2

    while (
        db.query(Tenant)
        .filter(
            Tenant.organization_id == organization_id,
            Tenant.slug == slug,
        )
        .first()
    ):
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    tenant = Tenant(
        organization_id=organization_id,
        name=data.name.strip(),
        slug=slug,
    )

    db.add(tenant)
    db.flush()

    # The creator is also registered as a Tenant Admin.
    db.add(
        Membership(
            user_id=current_user.id,
            organization_id=organization_id,
            tenant_id=tenant.id,
            role="tenant_admin",
        )
    )

    db.commit()
    db.refresh(tenant)

    return tenant


@router.get(
    "/{organization_id}/tenants",
    response_model=list[TenantResponse],
)
def list_tenants(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_org_access(db, current_user.id, organization_id)

    if is_org_admin(db, current_user.id, organization_id):
        return (
            db.query(Tenant)
            .filter(Tenant.organization_id == organization_id)
            .order_by(Tenant.id)
            .all()
        )

    tenant_ids = (
        db.query(Membership.tenant_id)
        .filter(
            Membership.user_id == current_user.id,
            Membership.organization_id == organization_id,
            Membership.tenant_id.isnot(None),
        )
        .all()
    )

    ids = [item[0] for item in tenant_ids]

    return (
        db.query(Tenant)
        .filter(
            Tenant.organization_id == organization_id,
            Tenant.id.in_(ids),
        )
        .order_by(Tenant.id)
        .all()
    )


@router.post(
    "/{organization_id}/tenants/{tenant_id}/members",
    status_code=status.HTTP_201_CREATED,
)
def add_tenant_member(
    organization_id: int,
    tenant_id: int,
    data: AddTenantMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant = (
        db.query(Tenant)
        .filter(
            Tenant.id == tenant_id,
            Tenant.organization_id == organization_id,
        )
        .first()
    )

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")

    require_tenant_manager(
        db, current_user.id, organization_id, tenant_id
    )

    target_user = (
        db.query(User)
        .filter(User.email == data.email.lower().strip())
        .first()
    )

    if not target_user:
        raise HTTPException(
            status_code=404,
            detail="No registered user found with this email.",
        )

    if is_org_admin(db, target_user.id, organization_id):
        raise HTTPException(
            status_code=409,
            detail="This user is already an Organization Admin.",
        )

    existing = (
        db.query(Membership)
        .filter(
            Membership.user_id == target_user.id,
            Membership.organization_id == organization_id,
            Membership.tenant_id == tenant_id,
        )
        .first()
    )

    if existing:
        existing.role = data.role
        db.commit()
        return {"message": "Tenant member role updated successfully."}

    membership = Membership(
        user_id=target_user.id,
        organization_id=organization_id,
        tenant_id=tenant_id,
        role=data.role,
    )

    db.add(membership)
    db.commit()

    return {"message": "Tenant member added successfully."}


@router.get(
    "/{organization_id}/tenants/{tenant_id}/members",
    response_model=list[TenantMemberResponse],
)
def list_tenant_members(
    organization_id: int,
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant = (
        db.query(Tenant)
        .filter(
            Tenant.id == tenant_id,
            Tenant.organization_id == organization_id,
        )
        .first()
    )

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")

    require_tenant_access(
        db, current_user.id, organization_id, tenant_id
    )

    memberships = (
        db.query(Membership, User)
        .join(User, User.id == Membership.user_id)
        .filter(
            Membership.organization_id == organization_id,
            Membership.tenant_id == tenant_id,
        )
        .all()
    )

    return [
        TenantMemberResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            role=membership.role,
        )
        for membership, user in memberships
    ]
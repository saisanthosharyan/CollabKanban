from pydantic import BaseModel, Field


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)


class OrganizationResponse(BaseModel):
    id: int
    name: str
    slug: str

    model_config = {"from_attributes": True}


class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)


class TenantResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    slug: str

    model_config = {"from_attributes": True}


class AddTenantMemberRequest(BaseModel):
    email: str
    role: str = Field(default="member", pattern="^(tenant_admin|member)$")


class TenantMemberResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
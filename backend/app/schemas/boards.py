from pydantic import BaseModel, Field, ConfigDict


class BoardCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str | None = None


class BoardResponse(BaseModel):
    id: int
    organization_id: int
    tenant_id: int
    name: str
    description: str | None

    model_config = ConfigDict(from_attributes=True)


class ColumnCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    position: int = 1000


class ColumnResponse(BaseModel):
    id: int
    tenant_id: int
    board_id: int
    name: str
    position: int

    model_config = ConfigDict(from_attributes=True)


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    priority: str = Field(default="medium", pattern="^(low|medium|high|urgent)$")
    column_id: int
    position: int = 1000
    assigned_to: int | None = None


class TaskUpdate(BaseModel):
    version: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    priority: str | None = Field(default=None, pattern="^(low|medium|high|urgent)$")
    column_id: int | None = None
    position: int | None = None
    assigned_to: int | None = None


class TaskResponse(BaseModel):
    id: int
    tenant_id: int
    board_id: int
    column_id: int
    title: str
    description: str | None
    priority: str
    position: int
    assigned_to: int | None
    version: int

    model_config = ConfigDict(from_attributes=True)
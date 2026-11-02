# CollabKanban Database ER Diagram

The database contains eight primary application tables.

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ TENANTS : contains
    ORGANIZATIONS ||--o{ MEMBERSHIPS : has
    USERS ||--o{ MEMBERSHIPS : joins
    TENANTS ||--o{ MEMBERSHIPS : has
    ORGANIZATIONS ||--o{ BOARDS : owns
    TENANTS ||--o{ BOARDS : contains
    BOARDS ||--o{ COLUMNS : contains
    BOARDS ||--o{ TASKS : groups
    COLUMNS ||--o{ TASKS : contains
    USERS ||--o{ TASKS : assigned_to
    USERS ||--o{ ACTIVITY_LOGS : performs

    ORGANIZATIONS {
        int id PK
        string name
        string slug
    }

    TENANTS {
        int id PK
        int organization_id FK
        string name
    }

    USERS {
        int id PK
        string email
        string hashed_password
    }

    MEMBERSHIPS {
        int id PK
        int user_id FK
        int organization_id FK
        int tenant_id FK
        string role
    }

    BOARDS {
        int id PK
        int organization_id FK
        int tenant_id FK
        string name
    }

    COLUMNS {
        int id PK
        int tenant_id FK
        int board_id FK
        string name
        int position
    }

    TASKS {
        int id PK
        int tenant_id FK
        int board_id FK
        int column_id FK
        int version
        string title
        string description
    }

    ACTIVITY_LOGS {
        int id PK
        int organization_id FK
        int tenant_id FK
        int board_id FK
        int user_id FK
        string action
    }
```

## Design notes

- Organizations are the top-level isolation boundary.
- Tenants represent branches or workspaces inside organizations.
- Memberships connect users to organizations and tenants with roles.
- Boards belong to a specific organization and tenant.
- Columns belong to boards.
- Tasks belong to boards and columns and carry a version number for optimistic concurrency.
- Activity logs record task-related actions and the user responsible.

Composite foreign keys and unique constraints in the SQLAlchemy models enforce important organization and tenant relationships.

The diagram is a conceptual overview. The SQLAlchemy models and Alembic migration are the authoritative schema definitions.
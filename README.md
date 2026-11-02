# CollabKanban

**A multi-tenant, real-time collaborative Kanban workspace**

CollabKanban is a full-stack project management application designed to help teams organize work across multiple organizations, branches (tenants), boards, columns and tasks.

It provides JWT-based authentication, role-based access checks, tenant-scoped data access, collaborative task updates, optimistic concurrency control and WebSocket-based real-time synchronization.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Core Features](#core-features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Multi-Tenancy Design](#multi-tenancy-design)
- [Database Design](#database-design)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Database Migrations](#database-migrations)
- [REST API Documentation](#rest-api-documentation)
- [WebSocket Documentation](#websocket-documentation)
- [Concurrency Control](#concurrency-control)
- [Security](#security)
- [Implementation Status](#implementation-status)
- [Future Improvements](#future-improvements)

---

## Project Overview

CollabKanban follows this organizational hierarchy:

```text
Organization
    |
    +-- Tenant / Branch
            |
            +-- Board
                    |
                    +-- Columns
                            |
                            +-- Tasks
```

A user can belong to an organization or a specific tenant, depending on their membership and assigned role.

The backend validates organization, tenant and board access before allowing users to access or modify tenant-scoped resources.

## Core Features

### Authentication and authorization

- User registration and login.
- JWT-based authentication.
- Password hashing using Argon2.
- Authenticated user profile endpoint.
- Organization-level and tenant-level membership checks.
- Role-based access checks for administrative operations.

### Organization and tenant management

- Create and list organizations.
- Retrieve organization details.
- Create and list tenants within an organization.
- Add members to tenants.
- List tenant members.
- Validate organization and tenant access.

### Kanban workspace

- Create and list boards.
- Retrieve board details.
- Create and list board columns.
- Create, list, update and delete tasks.
- Assign tasks to valid users.
- Move tasks between columns.
- Store task descriptions, priorities and other task information.

### Real-time collaboration

- WebSocket connections scoped to an organization, tenant and board.
- Real-time task creation events.
- Real-time task update events.
- Real-time task deletion events.
- Connection and disconnection presence events.
- Ping/pong handling.
- Automatic frontend reconnection handling.

### Data consistency

- Task version numbers.
- Optimistic concurrency checks.
- Atomic version-based task updates.
- Conflict responses when a task has been modified by another user.
- Activity logging for task creation, updates and deletion.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 |
| UI | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Drag and drop | dnd-kit |
| Icons | Lucide React |
| Backend | FastAPI |
| Backend language | Python |
| ORM | SQLAlchemy |
| Database migrations | Alembic |
| Authentication | JWT |
| Password hashing | Argon2 |
| Real-time communication | WebSockets |
| Development database | SQLite |
| PostgreSQL driver | Psycopg 3 |

---

## System Architecture

```mermaid
flowchart TD
    U[Users / Browsers]
    F[Next.js Frontend]
    A[FastAPI Backend]
    AUTH[JWT Authentication]
    ORG[Organization and Tenant APIs]
    BOARD[Board and Task APIs]
    WS[WebSocket Manager]
    DB[(SQL Database)]
    LOG[Activity Logs]

    U --> F
    F -->|REST API| A
    F <-->|WebSocket| WS
    A --> AUTH
    A --> ORG
    A --> BOARD
    ORG --> DB
    BOARD --> DB
    BOARD --> LOG
    BOARD --> WS
    WS -->|Board-scoped events| F
```

### Request flow

1. A user authenticates through the frontend.
2. The backend validates credentials and returns a JWT.
3. The frontend uses the token for authenticated API requests.
4. The backend validates the user's membership and requested organization and tenant.
5. Database operations are scoped to the authorized organization and tenant.
6. Task changes are persisted to the database.
7. The backend broadcasts the corresponding event to connected clients in the board's WebSocket room.
8. Other connected clients refresh their board data to display the change.

---

## Multi-Tenancy Design

CollabKanban uses a shared-database, shared-schema multi-tenancy approach.

Multiple organizations share the same database tables, while organization and tenant identifiers separate their data.

### Tenant hierarchy

```text
Organization A
    |
    +-- Hyderabad Branch
    |       |
    |       +-- Engineering Board
    |       +-- Marketing Board
    |
    +-- Bangalore Branch
            |
            +-- Operations Board

Organization B
    |
    +-- Chennai Branch
            |
            +-- Development Board
```

### Isolation strategy

The backend applies multiple levels of validation:

- Organization membership is checked before organization resources are accessed.
- Tenant membership or authorized organization-level access is checked before tenant resources are accessed.
- Board ownership is validated against the requested organization and tenant.
- Task and column operations are scoped to the requested board and tenant.
- Composite foreign keys help prevent invalid cross-tenant relationships at the database level.
- Task assignees are validated against the permitted organization and tenant context.

### Roles

The application supports the following role categories:

| Role | Purpose |
|---|---|
| Org Admin | Organization-level administration |
| Tenant Admin | Tenant-level administration |
| Member | Regular workspace participation |

The backend contains role and membership checks for administrative operations. The precise permissions available to each role depend on the endpoint's authorization rules.

### Why shared-schema multi-tenancy?

This approach was selected because it:

- Reduces database infrastructure complexity.
- Makes organization and tenant management easier.
- Supports a shared application deployment.
- Avoids maintaining a separate database for every tenant.
- Uses relational constraints and backend authorization to protect tenant boundaries.

A separate database per tenant could be considered later for customers requiring stronger infrastructure isolation.

---

## Database Design

The application defines eight primary tables.

| Table | Purpose |
|---|---|
| organizations | Stores organization information |
| tenants | Stores branches or tenant workspaces |
| users | Stores user accounts |
| memberships | Stores organization and tenant membership and roles |
| boards | Stores Kanban boards |
| columns | Stores board columns and their ordering |
| tasks | Stores Kanban tasks and version information |
| activity_logs | Stores task activity history |

### Entity Relationship Diagram

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ TENANTS : contains
    ORGANIZATIONS ||--o{ MEMBERSHIPS : has
    USERS ||--o{ MEMBERSHIPS : joins
    TENANTS ||--o{ MEMBERSHIPS : has
    ORGANIZATIONS ||--o{ BOARDS : owns
    TENANTS ||--o{ BOARDS : contains
    BOARDS ||--o{ COLUMNS : contains
    COLUMNS ||--o{ TASKS : contains
    BOARDS ||--o{ TASKS : groups
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
        int board_id FK
        int tenant_id FK
        string name
        int position
    }

    TASKS {
        int id PK
        int board_id FK
        int column_id FK
        int tenant_id FK
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

The diagram represents the conceptual relationships. The SQLAlchemy models and Alembic migration define the actual database constraints and columns.

---

## Getting Started

### Prerequisites

Install the following:

- Python 3.12 or compatible version.
- Node.js and npm.
- Git.

SQLite is used by default, so a separate database server is not required for local development.

### 1. Clone the repository

```bash
git clone https://github.com/saisanthosharyan/CollabKanban.git
cd CollabKanban
```

### 2. Backend setup

Open a terminal:

```powershell
cd backend

python -m venv venv

.\venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

### 3. Configure the backend

Create a `.env` file inside the `backend` directory.

Example:

```env
APP_NAME=CollabKanban API
APP_VERSION=1.0.0
DEBUG=True

DATABASE_URL=sqlite:///./collabkanban.db

JWT_SECRET_KEY=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

FRONTEND_URL=http://localhost:3000
```

Use a secure secret key outside local development. Never commit `.env` files or production credentials.

### 4. Run database migrations

From the backend directory:

```powershell
alembic upgrade head
```

### 5. Start the backend

```powershell
python -m uvicorn app.main:app --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

### 6. Frontend setup

Open another terminal:

```powershell
cd frontend

npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Start the frontend:

```powershell
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

---

## Environment Configuration

### Database configuration

The application uses SQLite by default.

SQLite:

```env
DATABASE_URL=sqlite:///./collabkanban.db
```

PostgreSQL using Psycopg 3:

```env
DATABASE_URL=postgresql+psycopg://username:password@localhost:5432/collabkanban
```

The backend database configuration supports PostgreSQL URL normalization and the Psycopg 3 driver.

For PostgreSQL deployment, create the database, configure the connection credentials, and apply migrations using:

```powershell
alembic upgrade head
```

The local SQLite migration has been tested. A live PostgreSQL deployment should be validated separately before production use.

---

## Database Migrations

Alembic manages database schema changes.

The initial schema migration creates the eight application tables and their defined constraints and indexes.

Useful commands:

Check the current migration:

```powershell
alembic current
```

Apply migrations:

```powershell
alembic upgrade head
```

Create a new migration:

```powershell
alembic revision --autogenerate -m "describe schema change"
```

Review the generated migration before applying it.

The existing development database is tracked at the initial migration revision.

---

## REST API Documentation

Base URL:

```text
http://127.0.0.1:8000
```

Most protected endpoints require:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register a user |
| POST | `/api/auth/login` | Authenticate a user |
| GET | `/api/auth/me` | Get the authenticated user |

### Organizations and tenants

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/organizations` | Create an organization |
| GET | `/api/organizations` | List accessible organizations |
| GET | `/api/organizations/{organization_id}` | Retrieve an organization |
| POST | `/api/organizations/{organization_id}/tenants` | Create a tenant |
| GET | `/api/organizations/{organization_id}/tenants` | List tenants |
| POST | `/api/organizations/{organization_id}/tenants/{tenant_id}/members` | Add a tenant member |
| GET | `/api/organizations/{organization_id}/tenants/{tenant_id}/members` | List tenant members |

### Boards, columns and tasks

The following endpoints use this base path:

```text
/api/organizations/{organization_id}/tenants/{tenant_id}
```

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/boards` | Create a board |
| GET | `/boards` | List boards |
| GET | `/boards/{board_id}` | Retrieve a board |
| POST | `/boards/{board_id}/columns` | Create a column |
| GET | `/boards/{board_id}/columns` | List columns |
| POST | `/boards/{board_id}/tasks` | Create a task |
| GET | `/boards/{board_id}/tasks` | List tasks |
| PATCH | `/boards/{board_id}/tasks/{task_id}` | Update a task |
| DELETE | `/boards/{board_id}/tasks/{task_id}` | Delete a task |

Interactive API documentation is available through FastAPI Swagger UI at `/docs`.

---

## WebSocket Documentation

### Connection endpoint

```text
/ws/organizations/{organization_id}/tenants/{tenant_id}/boards/{board_id}?token=YOUR_JWT_TOKEN
```

Example:

```javascript
const socket = new WebSocket(
  `ws://127.0.0.1:8000/ws/organizations/1/tenants/1/boards/1?token=${token}`
);
```

The connection is authenticated using the JWT token and validated against the requested organization, tenant, board and membership.

### Events

| Event | Purpose |
|---|---|
| `task_created` | A task has been created |
| `task_updated` | A task has been updated |
| `task_deleted` | A task has been deleted |
| `presence_connected` | A client connected |
| `presence_disconnected` | A client disconnected |
| `ping` / `pong` | Connection keepalive |

Task events are broadcast to the corresponding organization, tenant and board room.

### Example client handler

```javascript
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case "task_created":
    case "task_updated":
    case "task_deleted":
      // Refresh the current board data.
      break;

    case "presence_connected":
    case "presence_disconnected":
      // Handle connection presence.
      break;

    case "pong":
      // Keepalive response.
      break;
  }
};
```

The frontend also includes reconnection handling to recover from interrupted WebSocket connections.

**Deployment note:** The current WebSocket connection manager uses in-memory connection tracking. Multi-worker deployments require a shared message-broadcast mechanism such as Redis Pub/Sub.

---

## Concurrency Control

CollabKanban uses optimistic concurrency control for task updates.

Every task contains a version number.

When a client updates a task, it sends the version it last read.

The backend performs an atomic update using both the task identifier and expected version.

Conceptually:

```sql
UPDATE tasks
SET
    title = :new_title,
    version = version + 1
WHERE
    id = :task_id
    AND version = :expected_version;
```

If the update succeeds, the task version increases.

If another client has already updated the task, the expected version no longer matches. The API returns HTTP `409 Conflict` with the current version information.

This prevents a stale client from silently overwriting a newer task update.

---

## Security

The project includes:

- JWT-based authentication.
- Argon2 password hashing.
- Authenticated API endpoints.
- Organization and tenant membership validation.
- Role-based administrative checks.
- Tenant-scoped board and task operations.
- Composite database constraints for tenant relationships.
- WebSocket authentication and board-scope validation.
- Environment-based database and secret configuration.

Production deployment should additionally use HTTPS/WSS, a strong secret-management strategy, database backups, appropriate rate limiting and a shared WebSocket event layer for multiple application workers.

---

## Implementation Status

| Requirement | Status |
|---|---|
| User registration and login | Implemented |
| JWT authentication | Implemented |
| Organization management | Implemented |
| Tenant management | Implemented |
| Membership and role checks | Implemented |
| Board creation and listing | Implemented |
| Column creation and listing | Implemented |
| Task CRUD | Implemented |
| Drag-and-drop task movement | Implemented |
| Real-time task synchronization | Implemented and tested locally |
| WebSocket reconnection handling | Implemented |
| Task versioning | Implemented |
| Optimistic concurrency conflict handling | Implemented |
| Task activity logging | Implemented |
| Alembic initial migration | Implemented and tested with SQLite |
| PostgreSQL live deployment | Not yet verified |
| Redis-based multi-worker broadcasting | Not implemented |
| Full collaborative presence interface | Not yet completed |
| Undo/redo | Not implemented |
| Automated backend test suite | Needs completion |

---

## Future Improvements

- Redis Pub/Sub for multi-instance WebSocket broadcasting.
- More detailed real-time presence indicators.
- Undo and redo for board operations.
- Improved offline support and network recovery.
- Expanded activity history interface.
- More comprehensive automated backend tests.
- Additional board and column management operations.
- PostgreSQL deployment and integration testing.
- Production deployment, monitoring and logging.

---

## Repository Structure

```text
CollabKanban/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── websockets/
│   │
│   ├── alembic/
│   │   └── versions/
│   ├── alembic.ini
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── hooks/
│       └── lib/
│
├── .gitignore
└── README.md
```

---

## License

This project was developed as a collaborative Kanban application assignment.

---

**Built with Next.js, FastAPI, SQLAlchemy, Alembic and WebSockets.**
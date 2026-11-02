# CollabKanban API Reference

Base URL: `http://127.0.0.1:8000`

Interactive Swagger documentation: `/docs`

## Authentication

Protected HTTP endpoints use a JWT bearer token.

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |

## Organizations and tenants

| Method | Path | Description |
|---|---|---|
| POST | `/api/organizations` | Create organization |
| GET | `/api/organizations` | List accessible organizations |
| GET | `/api/organizations/{organization_id}` | Get organization |
| POST | `/api/organizations/{organization_id}/tenants` | Create tenant |
| GET | `/api/organizations/{organization_id}/tenants` | List tenants |
| POST | `/api/organizations/{organization_id}/tenants/{tenant_id}/members` | Add tenant member |
| GET | `/api/organizations/{organization_id}/tenants/{tenant_id}/members` | List tenant members |

## Boards, columns and tasks

Base path:

```text
/api/organizations/{organization_id}/tenants/{tenant_id}
```

| Method | Path | Description |
|---|---|---|
| POST | `/boards` | Create board |
| GET | `/boards` | List boards |
| GET | `/boards/{board_id}` | Get board |
| POST | `/boards/{board_id}/columns` | Create column |
| GET | `/boards/{board_id}/columns` | List columns |
| POST | `/boards/{board_id}/tasks` | Create task |
| GET | `/boards/{board_id}/tasks` | List tasks |
| PATCH | `/boards/{board_id}/tasks/{task_id}` | Update task |
| DELETE | `/boards/{board_id}/tasks/{task_id}` | Delete task |

## Task concurrency

Task updates use optimistic concurrency control.

Clients send the task's current version with an update. The backend atomically checks the version and increments it on success.

A stale version produces HTTP `409 Conflict`.

## WebSocket

Connection URL:

```text
/ws/organizations/{organization_id}/tenants/{tenant_id}/boards/{board_id}?token=YOUR_JWT_TOKEN
```

The WebSocket connection validates the token, user membership and board scope.

### Events

| Event | Description |
|---|---|
| `task_created` | Task created |
| `task_updated` | Task updated |
| `task_deleted` | Task deleted |
| `presence_connected` | Client connected |
| `presence_disconnected` | Client disconnected |
| `ping` | Keepalive request |
| `pong` | Keepalive response |

Task events are broadcast to clients connected to the matching board room.

The frontend handles task events by reloading the current board data.

### Deployment consideration

The current connection manager is in-memory and is suitable for a single backend process. A shared event broker such as Redis Pub/Sub is needed for synchronization across multiple backend workers.

## Error handling

Common HTTP responses include:

- `401 Unauthorized`: Missing or invalid authentication.
- `403 Forbidden`: Insufficient access.
- `404 Not Found`: Resource does not exist or is inaccessible.
- `409 Conflict`: Stale task version.
- `422 Unprocessable Entity`: Invalid request data.

Use `/docs` for the exact request schemas and response models.
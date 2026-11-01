
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const TOKEN_KEY = "collabkanban_token";

export type LoginResponse = {
  access_token: string;
  token_type: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
};

export type Organization = {
  id: number;
  name: string;
  slug: string;
};

export type Tenant = {
  id: number;
  organization_id: number;
  name: string;
  slug: string;
};

export type Board = {
  id: number;
  organization_id: number;
  tenant_id: number;
  name: string;
  description: string | null;
};

export type BoardColumn = {
  id: number;
  tenant_id: number;
  board_id: number;
  name: string;
  position: number;
};

export type Task = {
  id: number;
  tenant_id: number;
  board_id: number;
  column_id: number;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  position: number;
  assigned_to: number | null;
  version: number;
};

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  if (typeof window !== "undefined") {
    const token = localStorage.getItem(TOKEN_KEY);

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let requestBody: BodyInit | undefined;

  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      requestBody = options.body;
    } else {
      headers.set("Content-Type", "application/json");
      requestBody = JSON.stringify(options.body);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: requestBody,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);

    const detail = errorData?.detail;
    let message = `Request failed (${response.status})`;

    if (typeof detail === "string") {
      message = detail;
    } else if (detail) {
      message = JSON.stringify(detail);
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// Authentication

export async function login(email: string, password: string) {
  const result = await apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });

  localStorage.setItem(TOKEN_KEY, result.access_token);

  return result;
}

export async function register(
  name: string,
  email: string,
  password: string
) {
  const result = await apiRequest<LoginResponse>("/api/auth/register", {
    method: "POST",
    body: { name, email, password },
  });

  localStorage.setItem(TOKEN_KEY, result.access_token);

  return result;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasToken() {
  return typeof window !== "undefined" &&
    Boolean(localStorage.getItem(TOKEN_KEY));
}

export function getCurrentUser() {
  return apiRequest<User>("/api/auth/me");
}

// Organizations and tenants

export function getOrganizations() {
  return apiRequest<Organization[]>("/api/organizations");
}

export function createOrganization(name: string) {
  return apiRequest<Organization>("/api/organizations", {
    method: "POST",
    body: { name },
  });
}

export function getTenants(organizationId: number) {
  return apiRequest<Tenant[]>(
    `/api/organizations/${organizationId}/tenants`
  );
}

export function createTenant(organizationId: number, name: string) {
  return apiRequest<Tenant>(
    `/api/organizations/${organizationId}/tenants`,
    {
      method: "POST",
      body: { name },
    }
  );
}

// Boards and columns

export function getBoards(
  organizationId: number,
  tenantId: number
) {
  return apiRequest<Board[]>(
    `/api/organizations/${organizationId}/tenants/${tenantId}/boards`
  );
}

export function createBoard(
  organizationId: number,
  tenantId: number,
  name: string,
  description?: string
) {
  return apiRequest<Board>(
    `/api/organizations/${organizationId}/tenants/${tenantId}/boards`,
    {
      method: "POST",
      body: { name, description },
    }
  );
}

export function getColumns(
  organizationId: number,
  tenantId: number,
  boardId: number
) {
  return apiRequest<BoardColumn[]>(
    `/api/organizations/${organizationId}/tenants/${tenantId}/boards/${boardId}/columns`
  );
}

// Tasks

export function getTasks(
  organizationId: number,
  tenantId: number,
  boardId: number
) {
  return apiRequest<Task[]>(
    `/api/organizations/${organizationId}/tenants/${tenantId}/boards/${boardId}/tasks`
  );
}

export function createTask(
  organizationId: number,
  tenantId: number,
  boardId: number,
  task: {
    title: string;
    description?: string;
    priority: Task["priority"];
    column_id: number;
    position?: number;
    assigned_to?: number | null;
  }
) {
  return apiRequest<Task>(
    `/api/organizations/${organizationId}/tenants/${tenantId}/boards/${boardId}/tasks`,
    {
      method: "POST",
      body: task,
    }
  );
}

export function updateTask(
  organizationId: number,
  tenantId: number,
  boardId: number,
  taskId: number,
  changes: {
    version: number;
    title?: string;
    description?: string | null;
    priority?: Task["priority"];
    column_id?: number;
    position?: number;
    assigned_to?: number | null;
  }
) {
  return apiRequest<Task>(
    `/api/organizations/${organizationId}/tenants/${tenantId}/boards/${boardId}/tasks/${taskId}`,
    {
      method: "PATCH",
      body: changes,
    }
  );
}

export function deleteTask(
  organizationId: number,
  tenantId: number,
  boardId: number,
  taskId: number
) {
  return apiRequest<void>(
    `/api/organizations/${organizationId}/tenants/${tenantId}/boards/${boardId}/tasks/${taskId}`,
    { method: "DELETE" }
  );
}

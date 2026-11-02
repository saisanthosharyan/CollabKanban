
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import {
  Activity,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  Filter,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  Users,
  X,
  Zap,
} from "lucide-react";

import {
  getOrganizations,
  getTenants,
  getBoards,
  getColumns,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  hasToken,
  logout,
  type Organization,
  type Tenant,
  type Board,
  type BoardColumn,
  type Task as ApiTask,
} from "@/lib/api";

import { useBoardWebSocket } from "@/hooks/useBoardWebSocket";

// --------------------------------------------------
// Types
// --------------------------------------------------

type ColumnId = "todo" | "progress" | "done";

type Priority = "Low" | "Medium" | "High" | "Urgent";

type Task = {
  id: string;
  backendId: number;
  version: number;
  backendColumnId: number;
  title: string;
  description: string;
  columnId: ColumnId;
  priority: Priority;
  tag: string;
  dueDate: string;
  assignee: string;
  initials: string;
  color: string;
};

type DashboardColumn = {
  id: ColumnId;
  title: string;
  color: string;
};

type RealtimeTaskEvent = {
  type: string;
  board_id?: number;
  task_id?: number;
};

// --------------------------------------------------
// Static UI configuration
// --------------------------------------------------

const columns: DashboardColumn[] = [
  {
    id: "todo",
    title: "To do",
    color: "bg-slate-400",
  },
  {
    id: "progress",
    title: "In progress",
    color: "bg-blue-500",
  },
  {
    id: "done",
    title: "Done",
    color: "bg-emerald-500",
  },
];

const priorityStyles: Record<Priority, string> = {
  Low: "bg-slate-100 text-slate-600",
  Medium: "bg-amber-50 text-amber-700",
  High: "bg-orange-50 text-orange-700",
  Urgent: "bg-red-50 text-red-700",
};

const avatarColors = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
];

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function normalizePriority(value: string): Priority {
  const normalized = value.toLowerCase();

  if (normalized === "low") return "Low";
  if (normalized === "high") return "High";
  if (normalized === "urgent") return "Urgent";

  return "Medium";
}

function toApiPriority(value: Priority) {
  return value.toLowerCase() as
    | "low"
    | "medium"
    | "high"
    | "urgent";
}

function normalizeColumnName(name: string): ColumnId | null {
  const value = name.toLowerCase().replace(/[^a-z]/g, "");

  if (value.includes("todo")) return "todo";
  if (value.includes("progress")) return "progress";

  if (value.includes("done") || value.includes("complete")) {
    return "done";
  }

  return null;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);

  if (!name || name === "Unassigned") return "—";

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function mapApiTask(
  task: ApiTask,
  backendColumns: BoardColumn[],
  columnMap: Record<ColumnId, number | null>
): Task {
  const columnId =
    columns.find(
      (column) => columnMap[column.id] === task.column_id
    )?.id ?? "todo";

  const assignee =
    task.assigned_to != null
      ? `Member ${task.assigned_to}`
      : "Unassigned";

  const avatarIndex =
    task.assigned_to != null
      ? Math.abs(task.assigned_to) % avatarColors.length
      : 0;

  const backendColumn = backendColumns.find(
    (column) => column.id === task.column_id
  );

  return {
    id: String(task.id),
    backendId: task.id,
    version: task.version,
    backendColumnId: task.column_id,

    title: task.title,
    description: task.description ?? "",
    columnId,

    priority: normalizePriority(task.priority),
    tag: backendColumn?.name ?? "General",
    dueDate: "No date",

    assignee,
    initials: getInitials(assignee),
    color: avatarColors[avatarIndex],
  };
}

// --------------------------------------------------
// Avatar
// --------------------------------------------------

function Avatar({
  initials,
  color,
}: {
  initials: string;
  color: string;
}) {
  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-white ${color}`}
    >
      {initials}
    </div>
  );
}

// --------------------------------------------------
// Task Card
// --------------------------------------------------

function TaskCard({
  task,
  onSelect,
  selected,
}: {
  task: Task;
  onSelect: (task: Task) => void;
  selected: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(task)}
      className={`cursor-grab rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing ${
        selected
          ? "border-indigo-300 ring-2 ring-indigo-100"
          : "border-slate-200"
      } ${isDragging ? "z-50 opacity-40" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
          {task.tag}
        </span>

        <button
          type="button"
          aria-label="Task options"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal size={17} />
        </button>
      </div>

      <h3 className="text-sm font-semibold leading-5 text-slate-800">
        {task.title}
      </h3>

      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
        {task.description}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span
          className={`rounded-md px-2 py-1 text-[10px] font-semibold ${priorityStyles[task.priority]}`}
        >
          {task.priority}
        </span>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarDays size={13} />
          {task.dueDate}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2">
          <Avatar initials={task.initials} color={task.color} />

          <span className="text-xs text-slate-500">
            {task.assignee}
          </span>
        </div>

        <MessageSquare size={14} className="text-slate-400" />
      </div>
    </article>
  );
}

// --------------------------------------------------
// Board Column
// --------------------------------------------------

function BoardColumn({
  column,
  tasks,
  onSelect,
  selectedId,
  onAdd,
}: {
  column: DashboardColumn;
  tasks: Task[];
  onSelect: (task: Task) => void;
  selectedId?: string;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-[420px] min-w-0 flex-col rounded-2xl p-3 transition ${
        isOver ? "bg-indigo-50/80" : "bg-slate-100/80"
      }`}
    >
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${column.color}`}
          />

          <h2 className="text-sm font-semibold text-slate-700">
            {column.title}
          </h2>

          <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
            {tasks.length}
          </span>
        </div>

        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add task to ${column.title}`}
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900"
        >
          <Plus size={17} />
        </button>
      </div>

      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onSelect={onSelect}
              selected={selectedId === task.id}
            />
          ))}
        </div>
      </SortableContext>

      <button
        type="button"
        onClick={onAdd}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-medium text-slate-500 transition hover:border-indigo-300 hover:bg-white hover:text-indigo-600"
      >
        <Plus size={15} />
        Add task
      </button>
    </section>
  );
}

// --------------------------------------------------
// Main Dashboard
// --------------------------------------------------

export default function Home() {
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);

  const [orgId, setOrgId] = useState<number | null>(null);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [boardId, setBoardId] = useState<number | null>(null);

  const [columnMap, setColumnMap] = useState<Record<ColumnId, number | null>>({
    todo: null,
    progress: null,
    done: null,
  });

  const [search, setSearch] = useState("");
  const [dark, setDark] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("Medium");
  const [newColumn, setNewColumn] = useState<ColumnId>("todo");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyTask, setBusyTask] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const selectedOrganization = organizations.find(
    (item) => item.id === orgId
  );

  const selectedTenant = tenants.find(
    (item) => item.id === tenantId
  );

  const selectedBoard = boards.find(
    (item) => item.id === boardId
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  // ------------------------------------------------
  // Load actual board data
  // ------------------------------------------------

  const loadBoard = useCallback(
    async (organization: number, tenant: number, board: number) => {
      const [columnData, taskData] = await Promise.all([
        getColumns(organization, tenant, board),
        getTasks(organization, tenant, board),
      ]);

      const sortedColumns = [...columnData].sort(
        (a, b) => a.position - b.position
      );

      const mapping: Record<ColumnId, number | null> = {
        todo: null,
        progress: null,
        done: null,
      };

      sortedColumns.forEach((column, index) => {
        const matched = normalizeColumnName(column.name);

        if (matched) {
          mapping[matched] = column.id;
        } else if (index < 3) {
          mapping[columns[index].id] = column.id;
        }
      });

      const mappedTasks = taskData.map((task) =>
        mapApiTask(task, sortedColumns, mapping)
      );

      setColumnMap(mapping);
      setTasks(mappedTasks);

      setSelectedTask((current) => {
        if (!current) return null;

        return (
          mappedTasks.find(
            (task) => task.backendId === current.backendId
          ) ?? null
        );
      });
    },
    []
  );

  // ------------------------------------------------
  // Real-time task event handler
  // ------------------------------------------------

  const handleRealtimeTaskEvent = useCallback(
    (event: RealtimeTaskEvent) => {
      if (
        event.type !== "task_created" &&
        event.type !== "task_updated" &&
        event.type !== "task_deleted"
      ) {
        return;
      }

      if (
        orgId === null ||
        tenantId === null ||
        boardId === null
      ) {
        return;
      }

      // Reload the current board when another user changes it.
      void loadBoard(orgId, tenantId, boardId).catch((err) => {
        console.error("Real-time board refresh failed:", err);
        setError("Unable to synchronize the latest board changes.");
      });
    },
    [loadBoard, orgId, tenantId, boardId]
  );

  // ------------------------------------------------
  // WebSocket connection
  // ------------------------------------------------

  const { status: realtimeStatus } = useBoardWebSocket({
    organizationId: orgId,
    tenantId,
    boardId,
    enabled: !loading,
    onTaskEvent: handleRealtimeTaskEvent,
  });

  // ------------------------------------------------
  // Initialize organization / tenant / board
  // ------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        setLoading(true);
        setError("");

        if (!hasToken()) {
          router.replace("/login");
          return;
        }

        const orgData = await getOrganizations();

        if (cancelled) return;

        setOrganizations(orgData);

        if (orgData.length === 0) {
          setError("No organizations found. Please create an organization.");
          return;
        }

        const organization = orgData[0];

        setOrgId(organization.id);

        const tenantData = await getTenants(organization.id);

        if (cancelled) return;

        setTenants(tenantData);

        if (tenantData.length === 0) {
          setError("No tenants or branches found.");
          return;
        }

        const tenant = tenantData[0];

        setTenantId(tenant.id);

        const boardData = await getBoards(
          organization.id,
          tenant.id
        );

        if (cancelled) return;

        setBoards(boardData);

        if (boardData.length === 0) {
          setError("No boards found in this tenant.");
          return;
        }

        const board = boardData[0];

        setBoardId(board.id);

        await loadBoard(
          organization.id,
          tenant.id,
          board.id
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your workspace."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [router, loadBoard]);

  // ------------------------------------------------
  // Refresh
  // ------------------------------------------------

  async function handleRefresh() {
    if (orgId === null || tenantId === null || boardId === null) {
      return;
    }

    try {
      setRefreshing(true);
      setError("");

      await loadBoard(orgId, tenantId, boardId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to refresh board."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // ------------------------------------------------
  // Create task
  // ------------------------------------------------

  function openNewTask(columnId: ColumnId = "todo") {
    setNewColumn(columnId);
    setNewTitle("");
    setNewPriority("Medium");
    setShowModal(true);
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      orgId === null ||
      tenantId === null ||
      boardId === null ||
      !newTitle.trim()
    ) {
      return;
    }

    const backendColumnId = columnMap[newColumn];

    if (backendColumnId === null) {
      setError("The selected board column is unavailable.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await createTask(orgId, tenantId, boardId, {
        title: newTitle.trim(),
        description: "Add a description to this task.",
        priority: toApiPriority(newPriority),
        column_id: backendColumnId,
      });

      setShowModal(false);
      setNewTitle("");

      await loadBoard(orgId, tenantId, boardId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create task."
      );
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------------------------
  // Update task status
  // ------------------------------------------------

  async function handleStatusChange(
    task: Task,
    destination: ColumnId
  ) {
    if (
      orgId === null ||
      tenantId === null ||
      boardId === null
    ) {
      return;
    }

    const backendColumnId = columnMap[destination];

    if (backendColumnId === null) {
      setError("The destination column is unavailable.");
      return;
    }

    if (task.columnId === destination) return;

    try {
      setBusyTask(true);
      setError("");

      await updateTask(orgId, tenantId, boardId, task.backendId, {
        version: task.version,
        column_id: backendColumnId,
      });

      await loadBoard(orgId, tenantId, boardId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update task status."
      );

      try {
        await loadBoard(orgId, tenantId, boardId);
      } catch {
        // Keep the original API error visible.
      }
    } finally {
      setBusyTask(false);
    }
  }

  // ------------------------------------------------
  // Update task priority
  // ------------------------------------------------

  async function handlePriorityChange(
    task: Task,
    priority: Priority
  ) {
    if (
      orgId === null ||
      tenantId === null ||
      boardId === null ||
      task.priority === priority
    ) {
      return;
    }

    try {
      setBusyTask(true);
      setError("");

      await updateTask(orgId, tenantId, boardId, task.backendId, {
        version: task.version,
        priority: toApiPriority(priority),
      });

      await loadBoard(orgId, tenantId, boardId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update task priority."
      );

      try {
        await loadBoard(orgId, tenantId, boardId);
      } catch {
        // Keep the original error visible.
      }
    } finally {
      setBusyTask(false);
    }
  }
  // ------------------------------------------------
// Save task title and description
// ------------------------------------------------

async function handleSaveTaskDetails(
  task: Task,
  title: string,
  description: string
) {
  if (
    orgId === null ||
    tenantId === null ||
    boardId === null
  ) {
    return;
  }

  const cleanTitle = title.trim();

  if (!cleanTitle) {
    setError("Task title cannot be empty.");
    return;
  }

  try {
    setBusyTask(true);
    setError("");

    await updateTask(
      orgId,
      tenantId,
      boardId,
      task.backendId,
      {
        version: task.version,
        title: cleanTitle,
        description,
      }
    );

    await loadBoard(orgId, tenantId, boardId);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to save task details."
    );

    // Refresh to retrieve the latest version if a conflict occurred.
    try {
      await loadBoard(orgId, tenantId, boardId);
    } catch {
      // Keep the original save error.
    }
  } finally {
    setBusyTask(false);
  }
}

  // ------------------------------------------------
  // Delete task
  // ------------------------------------------------

  async function handleDeleteTask(task: Task) {
    if (
      orgId === null ||
      tenantId === null ||
      boardId === null
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${task.title}"?`
    );

    if (!confirmed) return;

    try {
      setBusyTask(true);
      setError("");

      await deleteTask(
        orgId,
        tenantId,
        boardId,
        task.backendId
      );

      setSelectedTask(null);

      await loadBoard(orgId, tenantId, boardId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete task."
      );
    } finally {
      setBusyTask(false);
    }
  }

  // ------------------------------------------------
  // Drag and drop
  // ------------------------------------------------

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveId(null);

    if (!over) return;

    const movingTask = tasks.find(
      (task) => task.id === String(active.id)
    );

    if (!movingTask) return;

    const targetId = String(over.id);

    const targetTask = tasks.find(
      (task) => task.id === targetId
    );

    const targetColumn = columns.find(
      (column) => column.id === targetId
    );

    const destination = targetColumn?.id ?? targetTask?.columnId;

    if (!destination || destination === movingTask.columnId) {
      return;
    }

    await handleStatusChange(movingTask, destination);
  }

  // ------------------------------------------------
  // Logout
  // ------------------------------------------------

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  // ------------------------------------------------
  // Derived dashboard values
  // ------------------------------------------------

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return tasks;

    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.tag.toLowerCase().includes(query)
    );
  }, [tasks, search]);

  const activeTask = tasks.find(
    (task) => task.id === activeId
  );

  const inProgressCount = tasks.filter(
    (task) => task.columnId === "progress"
  ).length;

  const completedCount = tasks.filter(
    (task) => task.columnId === "done"
  ).length;

  const page = dark
    ? "min-h-screen bg-[#111318] text-slate-100"
    : "min-h-screen bg-[#f7f8fa] text-slate-900";

  const realtimeLabel = {
    connected: "Live sync connected",
    connecting: "Connecting...",
    reconnecting: "Reconnecting...",
    disconnected: "Live sync disconnected",
  }[realtimeStatus];

  const realtimeColor = {
    connected: "text-emerald-600",
    connecting: "text-amber-600",
    reconnecting: "text-amber-600",
    disconnected: "text-slate-400",
  }[realtimeStatus];

  const realtimeDotColor = {
    connected: "bg-emerald-500",
    connecting: "bg-amber-500",
    reconnecting: "bg-amber-500",
    disconnected: "bg-slate-400",
  }[realtimeStatus];

  // ------------------------------------------------
  // Loading
  // ------------------------------------------------

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />

          <p className="text-sm font-medium text-slate-600">
            Loading your workspace...
          </p>
        </div>
      </main>
    );
  }

  // ------------------------------------------------
  // Dashboard UI
  // ------------------------------------------------

  return (
    <main className={page}>
      <div className="flex min-h-screen">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r p-5 transition-transform lg:static lg:translate-x-0 ${
            dark
              ? "border-white/10 bg-[#171a21]"
              : "border-slate-200 bg-white"
          } ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-9 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Command size={21} />
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-tight">
                CollabKanban
              </h1>

              <p className="text-[11px] text-slate-400">
                WORKSPACE
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="ml-auto rounded-lg p-1 text-slate-400 lg:hidden"
            >
              <X size={18} />
            </button>
          </div>

          {/* Organization */}
          <div
            className={`mb-7 rounded-xl border p-3 ${
              dark ? "border-white/10" : "border-slate-200"
            }`}
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Organization
            </p>

            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left"
              title={selectedOrganization?.name ?? "Organization"}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">
                  {selectedOrganization?.name
                    ?.slice(0, 2)
                    .toUpperCase() ?? "OR"}
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">
                    {selectedOrganization?.name ?? "Organization"}
                  </span>

                  <span className="block truncate text-[10px] text-slate-400">
                    {selectedTenant?.name ?? "Tenant"}
                  </span>
                </span>
              </span>

              <ChevronDown size={15} className="text-slate-400" />
            </button>
          </div>

          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </p>

          <nav className="space-y-1">
            {[
              { name: "Overview", icon: LayoutDashboard },
              { name: "My tasks", icon: ListTodo },
              { name: "Activity", icon: Activity },
              { name: "Team members", icon: Users },
            ].map((item, index) => {
              const Icon = item.icon;

              return (
                <button
                  type="button"
                  key={item.name}
                  onClick={() => {
                    if (index !== 0) {
                      setError(
                        `${item.name} is not available yet.`
                      );
                    } else {
                      setError("");
                    }
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    index === 0
                      ? "bg-indigo-50 font-semibold text-indigo-700"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon size={17} />
                  {item.name}
                </button>
              );
            })}
          </nav>

          {/* Boards */}
          <div className="mb-2 mt-8 flex items-center justify-between px-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Your boards
            </p>

            <button
              type="button"
              onClick={() => openNewTask()}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Create task"
            >
              <Plus size={15} />
            </button>
          </div>

          {boards.map((board) => (
            <button
              type="button"
              key={board.id}
              className={`mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                board.id === boardId
                  ? "bg-slate-100 font-medium text-slate-700"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <span className="truncate">{board.name}</span>
            </button>
          ))}

          {/* Sidebar footer */}
          <div className="mt-auto space-y-1 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setError("Settings are not available yet.")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              <Settings size={17} />
              Settings
            </button>

            <button
              type="button"
              onClick={() => setError("Help & support is not available yet.")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              <CircleHelp size={17} />
              Help & support
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex w-full items-center gap-3 rounded-xl bg-slate-50 p-3 text-left"
            >
              <Avatar
                initials="SA"
                color="bg-blue-100 text-blue-700"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">
                  Santhosh Aryan
                </p>

                <p className="text-[10px] text-slate-400">
                  Workspace member
                </p>
              </div>

              <LogOut size={15} className="text-slate-400" />
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Top navigation */}
          <header
            className={`sticky top-0 z-20 flex h-[70px] items-center justify-between border-b px-4 sm:px-7 ${
              dark
                ? "border-white/10 bg-[#171a21]"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              >
                <Menu size={20} />
              </button>

              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{selectedTenant?.name ?? "Workspace"}</span>
                  <span>/</span>
                  <span>Boards</span>
                </div>

                <h2 className="text-sm font-bold">
                  {selectedBoard?.name ?? "Kanban Board"}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <label className="hidden h-9 w-52 items-center gap-2 rounded-lg border border-slate-200 px-3 md:flex">
                <Search size={15} className="text-slate-400" />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tasks..."
                  className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
                />

                <span className="text-[10px] text-slate-400">
                  ⌘ K
                </span>
              </label>

              <button
                type="button"
                onClick={() => setDark((current) => !current)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Toggle theme"
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Refresh workspace"
                title="Refresh workspace"
              >
                <Bell size={18} />
              </button>

              <Avatar
                initials="SA"
                color="bg-blue-100 text-blue-700"
              />
            </div>
          </header>

          {/* Dashboard body */}
          <div className="p-4 sm:p-7">
            {/* Error banner */}
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                <span>{error}</span>

                <button
                  type="button"
                  onClick={() => setError("")}
                  aria-label="Dismiss error"
                >
                  <X size={17} />
                </button>
              </div>
            )}

            {/* Page heading */}
            <div className="mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                    Team workspace
                  </span>

                  <span
                    className={`flex items-center gap-1 text-[11px] ${realtimeColor}`}
                    title="Board WebSocket connection status"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${realtimeDotColor}`}
                    />
                    {realtimeLabel}
                  </span>
                </div>

                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {selectedBoard?.name ?? "Kanban Board"}
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Plan, organize and track your team&apos;s work.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-2 text-xs text-slate-500">
                  {tenants.length} tenant(s)
                </span>

                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Filter size={14} />
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>

                <button
                  type="button"
                  onClick={() => openNewTask()}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <Plus size={16} />
                  New task
                </button>
              </div>
            </div>

            {/* Statistics */}
            <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                {
                  label: "Total tasks",
                  value: tasks.length,
                  note: "Across this board",
                  icon: ListTodo,
                },
                {
                  label: "In progress",
                  value: inProgressCount,
                  note: "Currently being worked on",
                  icon: Zap,
                },
                {
                  label: "Completed",
                  value: completedCount,
                  note: "Successfully finished",
                  icon: Check,
                },
                {
                  label: "Team members",
                  value: "—",
                  note: "Member details unavailable",
                  icon: Users,
                },
              ].map((stat) => {
                const Icon = stat.icon;

                return (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        {stat.label}
                      </span>

                      <Icon size={16} className="text-slate-400" />
                    </div>

                    <p className="mt-2 text-2xl font-bold">
                      {stat.value}
                    </p>

                    <p className="mt-1 text-[10px] text-slate-400">
                      {stat.note}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Board heading */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">
                  Board overview
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Drag tasks between columns to update their status.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                aria-label="Refresh board"
              >
                <SlidersHorizontal size={16} />
              </button>
            </div>

            {/* Kanban board */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                {columns.map((column) => (
                  <BoardColumn
                    key={column.id}
                    column={column}
                    tasks={filteredTasks.filter(
                      (task) => task.columnId === column.id
                    )}
                    onSelect={setSelectedTask}
                    selectedId={selectedTask?.id}
                    onAdd={() => openNewTask(column.id)}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeTask ? (
                  <div className="rotate-2 rounded-xl border border-indigo-200 bg-white p-4 shadow-xl">
                    <p className="text-sm font-semibold text-slate-800">
                      {activeTask.title}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      {activeTask.priority} priority
                    </p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>
                CollabKanban · Team productivity workspace
              </span>

              <span>
                Tasks are synchronized with the backend database.
              </span>
            </div>
          </div>
        </div>

        {/* Task detail panel */}
        {selectedTask && (
          <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-[380px] overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-7 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Task details
              </span>

              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <span className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
              {selectedTask.tag}
            </span>

            <form
              key={`${selectedTask.backendId}-${selectedTask.version}`}
              onSubmit={(event) => {
                event.preventDefault();

                const formData = new FormData(event.currentTarget);

                void handleSaveTaskDetails(
                  selectedTask,
                  String(formData.get("title") ?? ""),
                  String(formData.get("description") ?? "")
                );
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label
                  htmlFor="edit-task-title"
                  className="mb-2 block text-xs font-semibold text-slate-400"
                >
                  TASK TITLE
                </label>

                <input
                  id="edit-task-title"
                  name="title"
                  type="text"
                  required
                  maxLength={200}
                  defaultValue={selectedTask.title}
                  disabled={busyTask}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-task-description"
                  className="mb-2 block text-xs font-semibold text-slate-400"
                >
                  DESCRIPTION
                </label>

                <textarea
                  id="edit-task-description"
                  name="description"
                  rows={4}
                  defaultValue={selectedTask.description}
                  disabled={busyTask}
                  placeholder="Add a description for this task..."
                  className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-600 outline-none focus:border-indigo-400 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={busyTask}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyTask ? "Saving..." : "Save Changes"}
              </button>
            </form>

            <div className="my-7 border-t border-slate-100" />

            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-400">
                  STATUS
                </p>

                <select
                  value={selectedTask.columnId}
                  disabled={busyTask}
                  onChange={(event) =>
                    handleStatusChange(
                      selectedTask,
                      event.target.value as ColumnId
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 disabled:opacity-50"
                >
                  {columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-400">
                  PRIORITY
                </p>

                <select
                  value={selectedTask.priority}
                  disabled={busyTask}
                  onChange={(event) =>
                    handlePriorityChange(
                      selectedTask,
                      event.target.value as Priority
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 disabled:opacity-50"
                >
                  {(
                    ["Low", "Medium", "High", "Urgent"] as Priority[]
                  ).map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-400">
                  ASSIGNEE
                </p>

                <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <Avatar
                    initials={selectedTask.initials}
                    color={selectedTask.color}
                  />

                  <span className="text-sm font-medium text-slate-700">
                    {selectedTask.assignee}
                  </span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-400">
                  DUE DATE
                </p>

                <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                  <CalendarDays size={16} />
                  {selectedTask.dueDate}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={busyTask}
              onClick={() => handleDeleteTask(selectedTask)}
              className="mt-9 w-full rounded-lg border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {busyTask ? "Please wait..." : "Delete task"}
            </button>
          </aside>
        )}
      </div>

      {/* Create task modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form
            onSubmit={handleCreateTask}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Create a new task
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Add a task to your engineering board.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mb-2 block text-xs font-semibold text-slate-600">
              Task title
            </label>

            <input
              autoFocus
              required
              maxLength={200}
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="What needs to be done?"
              className="mb-5 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-800 outline-none focus:border-indigo-400"
            />

            <label className="mb-2 block text-xs font-semibold text-slate-600">
              Status
            </label>

            <select
              value={newColumn}
              onChange={(event) =>
                setNewColumn(event.target.value as ColumnId)
              }
              className="mb-5 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-indigo-400"
            >
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title}
                </option>
              ))}
            </select>

            <label className="mb-2 block text-xs font-semibold text-slate-600">
              Priority
            </label>

            <select
              value={newPriority}
              onChange={(event) =>
                setNewPriority(event.target.value as Priority)
              }
              className="mb-6 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-indigo-400"
            >
              {(
                ["Low", "Medium", "High", "Urgent"] as Priority[]
              ).map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving || !newTitle.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create task"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}


"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getOrganizations,
  getTenants,
  getBoards,
  getColumns,
  getTasks,
  createTask,
  updateTask,
  hasToken,
  type Organization,
  type Tenant,
  type Board,
  type BoardColumn,
  type Task,
} from "@/lib/api";

export default function WorkspacePage() {
  const router = useRouter();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [orgId, setOrgId] = useState<number | null>(null);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [boardId, setBoardId] = useState<number | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [movingTaskId, setMovingTaskId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Load the selected board's columns and tasks.
  const loadBoard = useCallback(
    async (org: number, tenant: number, board: number) => {
      const [columnData, taskData] = await Promise.all([
        getColumns(org, tenant, board),
        getTasks(org, tenant, board),
      ]);

      setColumns(columnData);
      setTasks(taskData);
    },
    []
  );

  // Initialize the authenticated workspace.
  useEffect(() => {
    let cancelled = false;

    async function runInitialization() {
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
          setError("No organizations found. Create an organization first.");
          return;
        }

        const selectedOrg = orgData[0];
        setOrgId(selectedOrg.id);

        const tenantData = await getTenants(selectedOrg.id);
        if (cancelled) return;

        setTenants(tenantData);

        if (tenantData.length === 0) {
          setError("No branches found in this organization.");
          return;
        }

        const selectedTenant = tenantData[0];
        setTenantId(selectedTenant.id);

        const boardData = await getBoards(
          selectedOrg.id,
          selectedTenant.id
        );

        if (cancelled) return;

        setBoards(boardData);

        if (boardData.length === 0) {
          setError("No boards found in this branch.");
          return;
        }

        const selectedBoard = boardData[0];
        setBoardId(selectedBoard.id);

        const [columnData, taskData] = await Promise.all([
          getColumns(
            selectedOrg.id,
            selectedTenant.id,
            selectedBoard.id
          ),
          getTasks(
            selectedOrg.id,
            selectedTenant.id,
            selectedBoard.id
          ),
        ]);

        if (cancelled) return;

        setColumns(columnData);
        setTasks(taskData);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load workspace."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void runInitialization();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Refresh the current board.
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
          : "Unable to refresh the board."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // Create a task in the first available column.
  async function handleCreateTask(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      orgId === null ||
      tenantId === null ||
      boardId === null ||
      columns.length === 0 ||
      !newTitle.trim()
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      await createTask(orgId, tenantId, boardId, {
        title: newTitle.trim(),
        description: "",
        priority: "medium",
        column_id: columns[0].id,
      });

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

  // Move a task to the next column.
  async function handleMoveTask(task: Task) {
    if (
      orgId === null ||
      tenantId === null ||
      boardId === null ||
      columns.length < 2
    ) {
      return;
    }

    const currentIndex = columns.findIndex(
      (column) => column.id === task.column_id
    );

    if (currentIndex === -1) {
      setError("The task's current column could not be found.");
      return;
    }

    const nextColumn = columns[(currentIndex + 1) % columns.length];

    if (!nextColumn) return;

    try {
      setMovingTaskId(task.id);
      setError("");

      await updateTask(orgId, tenantId, boardId, task.id, {
        version: task.version,
        column_id: nextColumn.id,
      });

      await loadBoard(orgId, tenantId, boardId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to move task. Please refresh and try again."
      );

      // Reload to get the latest task version after a conflict.
      try {
        await loadBoard(orgId, tenantId, boardId);
      } catch {
        setError(
          "The task could not be moved or refreshed. Please try again."
        );
      }
    } finally {
      setMovingTaskId(null);
    }
  }

  // Loading screen.
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
          <p className="text-sm font-medium text-slate-600">
            Loading your real workspace...
          </p>
        </div>
      </main>
    );
  }

  const selectedOrganization = organizations.find(
    (item) => item.id === orgId
  );

  const selectedTenant = tenants.find(
    (item) => item.id === tenantId
  );

  const selectedBoard = boards.find(
    (item) => item.id === boardId
  );

  const inProgressCount = tasks.filter((task) => {
    const column = columns.find(
      (item) => item.id === task.column_id
    );

    return column?.name.toLowerCase().includes("progress");
  }).length;

  const completedCount = tasks.filter((task) => {
    const column = columns.find(
      (item) => item.id === task.column_id
    );

    return (
      column?.name.toLowerCase().includes("done") ||
      column?.name.toLowerCase().includes("complete")
    );
  }).length;

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">CollabKanban</h1>
            <p className="mt-1 text-sm text-slate-500">
              Real database workspace
            </p>
          </div>

          <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
            Backend connected
          </span>
        </header>

        {/* Organization information */}
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Organization
          </p>

          <h2 className="mt-1 text-lg font-semibold">
            {selectedOrganization?.name ?? "—"}
          </h2>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Tenant / Branch
          </p>

          <p className="mt-1 font-medium">
            {selectedTenant?.name ?? "—"}
          </p>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Board
          </p>

          <p className="mt-1 font-medium">
            {selectedBoard?.name ?? "—"}
          </p>
        </section>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Statistics */}
        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Total tasks</p>
            <p className="mt-2 text-3xl font-bold">{tasks.length}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">In progress</p>
            <p className="mt-2 text-3xl font-bold">
              {inProgressCount}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Completed</p>
            <p className="mt-2 text-3xl font-bold">
              {completedCount}
            </p>
          </div>
        </section>

        {/* Create task */}
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Create a task</h2>

          <form
            onSubmit={handleCreateTask}
            className="flex flex-wrap gap-3"
          >
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Enter task title..."
              required
              maxLength={200}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
            />

            <button
              type="submit"
              disabled={
                saving ||
                !boardId ||
                columns.length === 0 ||
                !newTitle.trim()
              }
              className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add task"}
            </button>
          </form>
        </section>

        {/* Board tasks */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Board tasks</h2>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-sm font-medium text-indigo-600 hover:underline disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {columns.map((column) => {
              const columnTasks = tasks.filter(
                (task) => task.column_id === column.id
              );

              return (
                <div
                  key={column.id}
                  className="min-h-64 rounded-xl border border-slate-200 bg-slate-100 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold">{column.name}</h3>

                    <span className="rounded-full bg-white px-3 py-1 text-xs">
                      {columnTasks.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {columnTasks.map((task) => (
                      <article
                        key={task.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <h4 className="font-medium">{task.title}</h4>

                        {task.description && (
                          <p className="mt-2 text-sm text-slate-500">
                            {task.description}
                          </p>
                        )}

                        <div className="mt-4 flex items-center justify-between gap-2">
                          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs capitalize text-indigo-700">
                            {task.priority}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleMoveTask(task)}
                            disabled={movingTaskId === task.id}
                            className="text-xs font-medium text-indigo-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {movingTaskId === task.id
                              ? "Moving..."
                              : "Move →"}
                          </button>
                        </div>
                      </article>
                    ))}

                    {columnTasks.length === 0 && (
                      <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-400">
                        No tasks yet
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

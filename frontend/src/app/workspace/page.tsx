
"use client";

import { useEffect, useState } from "react";
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
  const [error, setError] = useState("");

  async function loadBoard(org: number, tenant: number, board: number) {
    const [columnData, taskData] = await Promise.all([
      getColumns(org, tenant, board),
      getTasks(org, tenant, board),
    ]);

    setColumns(columnData);
    setTasks(taskData);
  }

  async function initialize() {
    try {
      setLoading(true);
      setError("");

      if (!hasToken()) {
        router.replace("/login");
        return;
      }

      const orgData = await getOrganizations();
      setOrganizations(orgData);

      if (!orgData.length) {
        setError("No organizations found.");
        return;
      }

      const org = orgData[0];
      setOrgId(org.id);

      const tenantData = await getTenants(org.id);
      setTenants(tenantData);

      if (!tenantData.length) {
        setError("No branches found in this organization.");
        return;
      }

      const tenant = tenantData[0];
      setTenantId(tenant.id);

      const boardData = await getBoards(org.id, tenant.id);
      setBoards(boardData);

      if (!boardData.length) {
        setError("No boards found in this branch.");
        return;
      }

      const board = boardData[0];
      setBoardId(board.id);

      await loadBoard(org.id, tenant.id, board.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load workspace.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    initialize();
  }, []);

  async function handleCreateTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!orgId || !tenantId || !boardId || !columns.length || !newTitle.trim()) {
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
      setError(err instanceof Error ? err.message : "Unable to create task.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMoveTask(task: Task) {
    if (!orgId || !tenantId || !boardId || !columns.length) return;

    const currentIndex = columns.findIndex(
      (column) => column.id === task.column_id
    );

    const nextColumn = columns[(currentIndex + 1) % columns.length];
    if (!nextColumn) return;

    try {
      setError("");

      await updateTask(orgId, tenantId, boardId, task.id, {
        version: task.version,
        column_id: nextColumn.id,
      });

      await loadBoard(orgId, tenantId, boardId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to move task.");
      await loadBoard(orgId, tenantId, boardId);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading your real workspace...</p>
      </main>
    );
  }

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

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Organization
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {organizations.find((item) => item.id === orgId)?.name ?? "—"}
          </h2>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Tenant / Branch
          </p>
          <p className="mt-1 font-medium">
            {tenants.find((item) => item.id === tenantId)?.name ?? "—"}
          </p>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Board
          </p>
          <p className="mt-1 font-medium">
            {boards.find((item) => item.id === boardId)?.name ?? "—"}
          </p>
        </section>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-slate-500">Total tasks</p>
            <p className="mt-2 text-3xl font-bold">{tasks.length}</p>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-slate-500">In progress</p>
            <p className="mt-2 text-3xl font-bold">
              {tasks.filter((task) =>
                columns.some(
                  (column) =>
                    column.id === task.column_id &&
                    column.name.toLowerCase().includes("progress")
                )
              ).length}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-slate-500">Completed</p>
            <p className="mt-2 text-3xl font-bold">
              {tasks.filter((task) =>
                columns.some(
                  (column) =>
                    column.id === task.column_id &&
                    column.name.toLowerCase().includes("done")
                )
              ).length}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Create a task</h2>
          <form onSubmit={handleCreateTask} className="flex flex-wrap gap-3">
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Enter task title..."
              required
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={saving || !boardId}
              className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add task"}
            </button>
          </form>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Board tasks</h2>
            <button
              onClick={() =>
                orgId && tenantId && boardId &&
                loadBoard(orgId, tenantId, boardId)
              }
              className="text-sm font-medium text-indigo-600"
            >
              Refresh
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
                            onClick={() => handleMoveTask(task)}
                            className="text-xs font-medium text-indigo-600 hover:underline"
                          >
                            Move →
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

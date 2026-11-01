
"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
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
  Sparkles,
  Sun,
  Users,
  X,
  Zap,
} from "lucide-react";

type ColumnId = "todo" | "progress" | "done";

type Task = {
  id: string;
  title: string;
  description: string;
  columnId: ColumnId;
  priority: "Low" | "Medium" | "High" | "Urgent";
  tag: string;
  dueDate: string;
  assignee: string;
  initials: string;
  color: string;
};

const initialTasks: Task[] = [
  {
    id: "task-1",
    title: "Design the new onboarding flow",
    description: "Create a simple and welcoming onboarding experience.",
    columnId: "todo",
    priority: "High",
    tag: "Design",
    dueDate: "Nov 04",
    assignee: "Alex Morgan",
    initials: "AM",
    color: "bg-violet-100 text-violet-700",
  },
  {
    id: "task-2",
    title: "Set up authentication API",
    description: "Complete JWT authentication and protected routes.",
    columnId: "todo",
    priority: "Urgent",
    tag: "Backend",
    dueDate: "Nov 03",
    assignee: "Santhosh",
    initials: "SA",
    color: "bg-blue-100 text-blue-700",
  },
  {
    id: "task-3",
    title: "Prepare database schema",
    description: "Review relationships between organizations and tenants.",
    columnId: "todo",
    priority: "Medium",
    tag: "Backend",
    dueDate: "Nov 06",
    assignee: "Jamie Lee",
    initials: "JL",
    color: "bg-amber-100 text-amber-700",
  },
  {
    id: "task-4",
    title: "Build dashboard components",
    description: "Implement reusable dashboard UI components.",
    columnId: "progress",
    priority: "High",
    tag: "Frontend",
    dueDate: "Nov 03",
    assignee: "Santhosh",
    initials: "SA",
    color: "bg-blue-100 text-blue-700",
  },
  {
    id: "task-5",
    title: "Create responsive navigation",
    description: "Make the navigation work on mobile and desktop.",
    columnId: "progress",
    priority: "Medium",
    tag: "Frontend",
    dueDate: "Nov 05",
    assignee: "Alex Morgan",
    initials: "AM",
    color: "bg-violet-100 text-violet-700",
  },
  {
    id: "task-6",
    title: "Initialize project repository",
    description: "Set up the project structure and GitHub repository.",
    columnId: "done",
    priority: "Low",
    tag: "Setup",
    dueDate: "Oct 30",
    assignee: "Santhosh",
    initials: "SA",
    color: "bg-blue-100 text-blue-700",
  },
  {
    id: "task-7",
    title: "Create organization models",
    description: "Implement organization and tenant database models.",
    columnId: "done",
    priority: "High",
    tag: "Backend",
    dueDate: "Oct 31",
    assignee: "Jamie Lee",
    initials: "JL",
    color: "bg-amber-100 text-amber-700",
  },
];

const columns: { id: ColumnId; title: string; color: string }[] = [
  { id: "todo", title: "To do", color: "bg-slate-400" },
  { id: "progress", title: "In progress", color: "bg-blue-500" },
  { id: "done", title: "Done", color: "bg-emerald-500" },
];

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
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityStyles = {
    Low: "bg-slate-100 text-slate-600",
    Medium: "bg-amber-50 text-amber-700",
    High: "bg-orange-50 text-orange-700",
    Urgent: "bg-red-50 text-red-700",
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(task)}
      className={`cursor-grab rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing ${
        selected ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"
      } ${isDragging ? "z-50 opacity-40" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
          {task.tag}
        </span>
        <button
          type="button"
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
          className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
            priorityStyles[task.priority]
          }`}
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
          <span className="text-xs text-slate-500">{task.assignee}</span>
        </div>
        <MessageSquare size={14} className="text-slate-400" />
      </div>
    </article>
  );
}

function BoardColumn({
  column,
  tasks,
  onSelect,
  selectedId,
  onAdd,
}: {
  column: (typeof columns)[number];
  tasks: Task[];
  onSelect: (task: Task) => void;
  selectedId?: string;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-[420px] min-w-0 flex-col rounded-2xl p-3 transition ${
        isOver ? "bg-indigo-50/80" : "bg-slate-100/80"
      }`}
    >
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${column.color}`} />
          <h2 className="text-sm font-semibold text-slate-700">
            {column.title}
          </h2>
          <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={onAdd}
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900"
          aria-label={`Add task to ${column.title}`}
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
        onClick={onAdd}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-medium text-slate-500 transition hover:border-indigo-300 hover:bg-white hover:text-indigo-600"
      >
        <Plus size={15} />
        Add task
      </button>
    </section>
  );
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dark, setDark] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] =
    useState<Task["priority"]>("Medium");
  const [newColumn, setNewColumn] = useState<ColumnId>("todo");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) =>
        task.title.toLowerCase().includes(search.toLowerCase())
      ),
    [tasks, search]
  );

  const activeTask = tasks.find((task) => task.id === activeId);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const movingTask = tasks.find((task) => task.id === String(active.id));
    if (!movingTask) return;

    const targetId = String(over.id);
    const targetTask = tasks.find((task) => task.id === targetId);

    const targetColumn = columns.find((column) => column.id === targetId);
    const destination = targetColumn?.id ?? targetTask?.columnId;

    if (!destination || destination === movingTask.columnId) return;

    setTasks((current) =>
      current.map((task) =>
        task.id === movingTask.id
          ? { ...task, columnId: destination }
          : task
      )
    );

    if (selectedTask?.id === movingTask.id) {
      setSelectedTask({ ...movingTask, columnId: destination });
    }
  }

  function openNewTask(columnId: ColumnId = "todo") {
    setNewColumn(columnId);
    setNewTitle("");
    setNewPriority("Medium");
    setShowModal(true);
  }

  function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTitle.trim()) return;

    const task: Task = {
      id: `task-${Date.now()}`,
      title: newTitle.trim(),
      description: "Add a description to this task.",
      columnId: newColumn,
      priority: newPriority,
      tag: "General",
      dueDate: "No date",
      assignee: "Santhosh",
      initials: "SA",
      color: "bg-blue-100 text-blue-700",
    };

    setTasks((current) => [...current, task]);
    setSelectedTask(task);
    setShowModal(false);
  }

  const page = dark
    ? "min-h-screen bg-[#111318] text-slate-100"
    : "min-h-screen bg-[#f7f8fa] text-slate-900";

  return (
    <main className={page}>
      <div className="flex min-h-screen">
        {sidebarOpen && (
          <button
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r p-5 transition-transform lg:static lg:translate-x-0 ${
            dark
              ? "border-white/10 bg-[#171a21]"
              : "border-slate-200 bg-white"
          } ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="mb-9 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Command size={21} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">CollabKanban</h1>
              <p className="text-[11px] text-slate-400">WORKSPACE</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto rounded-lg p-1 text-slate-400 lg:hidden"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mb-7 rounded-xl border border-slate-200 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Organization
            </p>
            <button className="flex w-full items-center justify-between gap-2 text-left">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">
                  AC
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">
                    Acme Technologies
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    Hyderabad Branch
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
                  key={item.name}
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

          <div className="mb-2 mt-8 flex items-center justify-between px-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Your boards
            </p>
            <button
              onClick={() => openNewTask()}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Create task"
            >
              <Plus size={15} />
            </button>
          </div>

          <button className="flex items-center gap-3 rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            Engineering Board
          </button>
          <button className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Marketing Board
          </button>

          <div className="mt-auto space-y-1 border-t border-slate-100 pt-4">
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100">
              <Settings size={17} /> Settings
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100">
              <CircleHelp size={17} /> Help & support
            </button>
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <Avatar initials="SA" color="bg-blue-100 text-blue-700" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">Santhosh Aryan</p>
                <p className="text-[10px] text-slate-400">Tenant Admin</p>
              </div>
              <LogOut size={15} className="text-slate-400" />
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header
            className={`sticky top-0 z-20 flex h-[70px] items-center justify-between border-b px-4 sm:px-7 ${
              dark
                ? "border-white/10 bg-[#171a21]"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              >
                <Menu size={20} />
              </button>
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Engineering</span>
                  <span>/</span>
                  <span>Boards</span>
                </div>
                <h2 className="text-sm font-bold">Engineering Board</h2>
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
                <span className="text-[10px] text-slate-400">⌘ K</span>
              </label>
              <button
                onClick={() => setDark(!dark)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Toggle theme"
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <Bell size={18} />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
              </button>
              <Avatar initials="SA" color="bg-blue-100 text-blue-700" />
            </div>
          </header>

          <div className="p-4 sm:p-7">
            <div className="mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                    Team workspace
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Workspace active
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Engineering Board
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Plan, organize and track your team's work.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex -space-x-2">
                  <Avatar initials="AM" color="bg-violet-100 text-violet-700" />
                  <Avatar initials="JL" color="bg-amber-100 text-amber-700" />
                  <Avatar initials="SA" color="bg-blue-100 text-blue-700" />
                </div>
                <span className="mr-2 text-xs text-slate-500">3 members</span>
                <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  <Filter size={14} /> Filter
                </button>
                <button
                  onClick={() => openNewTask()}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <Plus size={16} /> New task
                </button>
              </div>
            </div>

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
                  value: tasks.filter((task) => task.columnId === "progress").length,
                  note: "Currently being worked on",
                  icon: Zap,
                },
                {
                  label: "Completed",
                  value: tasks.filter((task) => task.columnId === "done").length,
                  note: "Successfully finished",
                  icon: Check,
                },
                {
                  label: "Team members",
                  value: 3,
                  note: "In this workspace",
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
                    <p className="mt-2 text-2xl font-bold">{stat.value}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {stat.note}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">Board overview</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Drag tasks between columns to update their status.
                </p>
              </div>
              <button className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50">
                <SlidersHorizontal size={16} />
              </button>
            </div>

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
              <span>CollabKanban · Team productivity workspace</span>
              <span>Changes are currently stored in this browser session.</span>
            </div>
          </div>
        </div>

        {selectedTask && (
          <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-[380px] overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-7 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Task details
              </span>
              <button
                onClick={() => setSelectedTask(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <span className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
              {selectedTask.tag}
            </span>
            <h2 className="mt-4 text-xl font-bold leading-7 text-slate-900">
              {selectedTask.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {selectedTask.description}
            </p>

            <div className="my-7 border-t border-slate-100" />
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-400">
                  STATUS
                </p>
                <select
                  value={selectedTask.columnId}
                  onChange={(event) => {
                    const columnId = event.target.value as ColumnId;
                    setTasks((current) =>
                      current.map((task) =>
                        task.id === selectedTask.id
                          ? { ...task, columnId }
                          : task
                      )
                    );
                    setSelectedTask({ ...selectedTask, columnId });
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400"
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
                  onChange={(event) => {
                    const priority = event.target.value as Task["priority"];
                    setTasks((current) =>
                      current.map((task) =>
                        task.id === selectedTask.id
                          ? { ...task, priority }
                          : task
                      )
                    );
                    setSelectedTask({ ...selectedTask, priority });
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400"
                >
                  {["Low", "Medium", "High", "Urgent"].map((priority) => (
                    <option key={priority}>{priority}</option>
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
              onClick={() => {
                setTasks((current) =>
                  current.filter((task) => task.id !== selectedTask.id)
                );
                setSelectedTask(null);
              }}
              className="mt-9 w-full rounded-lg border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Delete task
            </button>
          </aside>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form
            onSubmit={createTask}
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
              onChange={(event) => setNewColumn(event.target.value as ColumnId)}
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
                setNewPriority(event.target.value as Task["priority"])
              }
              className="mb-6 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-indigo-400"
            >
              {["Low", "Medium", "High", "Urgent"].map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Create task
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

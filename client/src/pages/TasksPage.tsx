import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api';
import type { Project, Task } from '../types';

type TaskStatusFilter = 'all' | Task['status'];

const taskStatuses: Array<{ value: Task['status']; label: string; badgeClass: string }> = [
  { value: 'todo', label: 'To do', badgeClass: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: 'In progress', badgeClass: 'bg-blue-50 text-blue-700' },
  { value: 'in_review', label: 'In review', badgeClass: 'bg-violet-50 text-violet-700' },
  { value: 'done', label: 'Done', badgeClass: 'bg-emerald-50 text-emerald-700' }
];

export function TasksPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TaskStatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [assignee, setAssignee] = useState('');
  const [labels, setLabels] = useState('');
  const [projectId, setProjectId] = useState('');
  const { data, isLoading, isError, error } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data } = await api.get('/tasks');
      return data.data.tasks;
    }
  });
  const { data: projects, isLoading: projectsLoading, isError: projectsError, error: projectsLoadError } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await api.get('/projects');
      return data.data.projects;
    }
  });
  const createTask = useMutation({
    mutationFn: async (task: {
      title: string;
      description: string;
      dueDate: string;
      priority: Task['priority'];
      assignee: string;
      labels: string[];
      projectId: string;
    }) => {
      const { data } = await api.post(`/projects/${task.projectId}/tasks`, {
        title: task.title,
        description: task.description,
        dueDate: task.dueDate || undefined,
        priority: task.priority,
        assignee: task.assignee || null,
        labels: task.labels
      });
      return data.data.task as Task;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['project'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      ]);
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('medium');
      setAssignee('');
      setLabels('');
      setProjectId('');
      toast.success('Task created.');
    },
    onError: (mutationError: Error) => toast.error(mutationError.message)
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ task, nextStatus }: { task: Task; nextStatus: Task['status'] }) => {
      const taskProjectId = typeof task.project === 'object' ? task.project?._id : task.project;
      if (!taskProjectId) throw new Error('Task project not found.');
      const { data } = await api.patch(`/projects/${taskProjectId}/tasks/${task._id}/status`, { status: nextStatus });
      return data.data.task as Task;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['project-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      ]);
      toast.success('Task status updated.');
    },
    onError: (mutationError: Error) => toast.error(mutationError.message)
  });

  const tasks = (data ?? []).filter((task) => {
    const projectName = typeof task.project === 'object' ? task.project?.name ?? '' : '';
    const taskProjectId = typeof task.project === 'object' ? task.project?._id : task.project;
    const matchesSearch = `${task.title} ${projectName} ${task.assignee?.fullName ?? ''}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase());
    return matchesSearch
      && (status === 'all' || task.status === status)
      && (projectFilter === 'all' || taskProjectId === projectFilter);
  });
  const tasksByProject = tasks.reduce<Array<{ id: string; name: string; color?: string; tasks: Task[] }>>((groups, task) => {
    const taskProjectId = typeof task.project === 'object' ? task.project?._id : task.project;
    const project = projects?.find((item) => item._id === taskProjectId);
    const groupId = taskProjectId ?? 'unknown-project';
    let group = groups.find((item) => item.id === groupId);
    if (!group) {
      group = {
        id: groupId,
        name: project?.name ?? (typeof task.project === 'object' ? task.project?.name : undefined) ?? 'Projet',
        color: project?.color,
        tasks: []
      };
      groups.push(group);
    }
    group.tasks.push(task);
    return groups;
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createTask.mutate({
      title,
      description,
      dueDate,
      priority,
      assignee,
      labels: labels.split(',').map((label) => label.trim()).filter(Boolean),
      projectId
    });
  };

  if (isLoading) return <div className="card">Loading tasks…</div>;
  if (isError) return <div className="card text-red-600">Error: {error instanceof Error ? error.message : 'Unable to load tasks.'}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Your work</p>
          <h2 className="text-3xl font-bold text-slate-900">Tasks</h2>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} className="mr-2" />
          New task
        </button>
      </div>

      <div className="card flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} />
          <input
            aria-label="Search tasks"
            className="input pl-10"
            placeholder="Search tasks..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <label className="text-sm font-medium text-slate-600">
          Status
          <select aria-label="Filter tasks by status" className="input mt-1 md:ml-2 md:mt-0 md:w-auto" value={status} onChange={(event) => setStatus(event.target.value as TaskStatusFilter)}>
            <option value="all">All</option>
            {taskStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-600">
          Project
          <select
            aria-label="Filter tasks by project"
            className="input mt-1 md:ml-2 md:mt-0 md:w-auto"
            disabled={projectsLoading || projectsError}
            onChange={(event) => setProjectFilter(event.target.value)}
            value={projectFilter}
          >
            <option value="all">All projects</option>
            {(projects ?? []).map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
          </select>
        </label>
      </div>

      {tasks.length ? (
        <div className="space-y-6">
          {tasksByProject.map((group) => (
            <section aria-labelledby={`project-${group.id}`} className="space-y-3" key={group.id}>
              <header className="flex items-center justify-between gap-3">
                {group.id === 'unknown-project' ? (
                  <h3 className="text-lg font-semibold text-slate-800" id={`project-${group.id}`}>{group.name}</h3>
                ) : (
                  <Link className="flex items-center gap-2 text-lg font-semibold text-slate-800 hover:text-indigo-700" id={`project-${group.id}`} to={`/projects/${group.id}`}>
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color || '#4f46e5' }} />
                    {group.name}
                  </Link>
                )}
                <span className="badge bg-slate-100 text-slate-600">{group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}</span>
              </header>
              <div className="space-y-3">
                {group.tasks.map((task) => {
                  const taskStatus = taskStatuses.find((item) => item.value === task.status) ?? taskStatuses[0];
                  const projectId = typeof task.project === 'object' ? task.project?._id : task.project;
                  return (
                    <article key={task._id} className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-semibold text-slate-900">{task.title}</h4>
                          <span className={`badge ${taskStatus.badgeClass}`}>{taskStatus.label}</span>
                          <span className="badge bg-amber-50 text-amber-700">{task.priority}</span>
                        </div>
                        {task.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{task.description}</p>}
                        <p className="mt-1 text-sm text-slate-500">                        {task.assignee?.fullName || 'Unassigned'}</p>
                        {task.labels?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {task.labels.map((label, index) => <span className="badge bg-indigo-50 text-indigo-700" key={`${task._id}-${label}-${index}`}>{label}</span>)}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm text-slate-500">
                        {task.dueDate ? <span>Due: {new Date(task.dueDate).toLocaleDateString('en-US')}</span> : <span>No due date</span>}
                        <label className="sr-only" htmlFor={`task-status-${task._id}`}>Change status of {task.title}</label>
                        <select
                          aria-label={`Change status of ${task.title}`}
                          className="input w-auto"
                          disabled={updateTaskStatus.isPending && updateTaskStatus.variables?.task._id === task._id}
                          id={`task-status-${task._id}`}
                          onChange={(event) => updateTaskStatus.mutate({ task, nextStatus: event.target.value as Task['status'] })}
                          value={task.status}
                        >
                          {taskStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                        {projectId && <Link className="text-indigo-700 hover:underline" to={`/projects/${projectId}`}>Open</Link>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="card text-center text-slate-500">{search || status !== 'all' || projectFilter !== 'all' ? 'No tasks match these filters.' : 'No tasks yet.'}</div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/50 p-4">
          <section aria-labelledby="create-task-title" aria-modal="true" className="card w-full max-w-lg space-y-4" role="dialog">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold" id="create-task-title">Create a task</h3>
              <button aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setCreateOpen(false)} type="button"><X size={18} /></button>
            </div>
            {projectsError ? (
              <p className="text-sm text-red-600" role="alert">
                Unable to load projects: {projectsLoadError instanceof Error ? projectsLoadError.message : 'Unexpected error.'}
              </p>
            ) : projectsLoading ? (
              <p className="text-sm text-slate-600">Loading projects…</p>
            ) : projects?.length ? (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block text-sm font-medium text-slate-700">
                  Project
                  <select aria-label="Project" className="input mt-1" onChange={(event) => { setProjectId(event.target.value); setAssignee(''); }} required value={projectId}>
                    <option value="">Select a project</option>
                    {projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Task title
                  <input aria-label="Titre" autoFocus className="input mt-1" maxLength={180} minLength={3} onChange={(event) => setTitle(event.target.value)} required value={title} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Description
                  <textarea className="input mt-1" maxLength={4000} onChange={(event) => setDescription(event.target.value)} rows={3} value={description} />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Priority
                    <select aria-label="Priority" className="input mt-1" onChange={(event) => setPriority(event.target.value as Task['priority'])} value={priority}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Due date
                    <input aria-label="Due date" className="input mt-1" onChange={(event) => setDueDate(event.target.value)} type="date" value={dueDate} />
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-700">
                  Assignee
                  <select aria-label="Assignee" className="input mt-1" onChange={(event) => setAssignee(event.target.value)} value={assignee}>
                    <option value="">Unassigned</option>
                    {(projects.find((project) => project._id === projectId)?.members ?? []).map((member) => {
                      const person = typeof member.user === 'string' ? null : member.user;
                      const memberId = typeof member.user === 'string' ? member.user : member.user._id;
                      return <option key={memberId} value={memberId}>{person?.fullName ?? person?.email ?? 'Member'}</option>;
                    })}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Labels (comma-separated)
                  <input aria-label="Labels" className="input mt-1" maxLength={500} onChange={(event) => setLabels(event.target.value)} placeholder="Design, Urgent" value={labels} />
                </label>
                <div className="flex justify-end gap-3">
                  <button className="btn-secondary" onClick={() => setCreateOpen(false)} type="button">Cancel</button>
                  <button className="btn-primary" disabled={createTask.isPending} type="submit">
                    {createTask.isPending ? 'Creating…' : 'Create task'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-sm text-slate-600">
                <p>You need to create or join a project before adding a task.</p>
                <Link className="btn-primary" to="/projects">View projects</Link>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

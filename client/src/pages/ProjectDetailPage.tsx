import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Copy, Plus, Share2, UserPlus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Project, Task, User } from '../types';

const taskStatuses: Array<{ value: Task['status']; label: string }> = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'in_review', label: 'In review' },
  { value: 'done', label: 'Done' }
];

type ProjectDetails = { project: Project; metrics: { totalTasks: number; completedTasks: number; overdueTasks: number; progress: number } };
type TaskChanges = {
  title?: string;
  description?: string;
  status?: Task['status'];
  priority?: Task['priority'];
  assignee?: string | null;
  dueDate?: string;
  labels?: string[];
};

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === 'done') return false;
  const endOfDueDate = new Date(task.dueDate);
  endOfDueDate.setHours(23, 59, 59, 999);
  return endOfDueDate.getTime() < Date.now();
}

export function ProjectDetailPage() {
  const { projectId = '' } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<Task['priority']>('medium');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskLabels, setTaskLabels] = useState('');

  const { data, isLoading, isError, error } = useQuery<ProjectDetails>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}`);
      return data.data;
    },
    enabled: Boolean(projectId)
  });
  const { data: tasks = [], isLoading: tasksLoading, isError: tasksError, error: tasksLoadError } = useQuery<Task[]>({
    queryKey: ['project-tasks', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/tasks`);
      return data.data.tasks;
    },
    enabled: Boolean(projectId && data?.project)
  });

  const members = data?.project.members ?? [];
  const currentMember = members.find((member) => {
    const memberId = typeof member.user === 'string' ? member.user : member.user?._id;
    return memberId === user?._id;
  });
  const canInvite = currentMember?.role === 'owner' || currentMember?.role === 'admin';
  const refreshProject = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  ]);

  const createTask = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/projects/${projectId}/tasks`, {
        title: taskTitle,
        description: taskDescription,
        dueDate: taskDueDate || undefined,
        priority: taskPriority,
        assignee: taskAssignee || null,
        labels: taskLabels.split(',').map((label) => label.trim()).filter(Boolean)
      });
      return data.data.task as Task;
    },
    onSuccess: async () => {
      await refreshProject();
      setShowTaskForm(false);
      resetTaskForm();
      toast.success('Task added to the project.');
    },
    onError: (mutationError: Error) => toast.error(mutationError.message)
  });

  const updateTask = useMutation({
    mutationFn: async ({ taskId, changes }: { taskId: string; changes: TaskChanges }) => {
      const { data } = await api.patch(`/projects/${projectId}/tasks/${taskId}`, changes);
      return data.data.task as Task;
    },
    onSuccess: async () => {
      await refreshProject();
      setEditingTask(null);
      toast.success('Task updated.');
    },
    onError: (mutationError: Error) => toast.error(mutationError.message)
  });

  const changeStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: Task['status'] }) => {
      const { data } = await api.patch(`/projects/${projectId}/tasks/${taskId}/status`, { status });
      return data.data.task as Task;
    },
    onSuccess: refreshProject,
    onError: (mutationError: Error) => toast.error(mutationError.message)
  });

  const inviteByEmail = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/projects/${projectId}/invitations`, { email: inviteEmail });
      return data.data.inviteUrl as string;
    },
    onSuccess: async (url) => {
      setInviteUrl(url);
      setInviteEmail('');
      await queryClient.invalidateQueries({ queryKey: ['project-invitations', projectId] });
      toast.success('Invitation created. Copy the link and share it with the invitee.');
    },
    onError: (mutationError: Error) => toast.error(mutationError.message)
  });

  const createShareLink = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/projects/${projectId}/invitation-link`);
      return data.data.inviteUrl as string;
    },
    onSuccess: (url) => {
      setInviteUrl(url);
      setShowShareLink(true);
      toast.success('Reusable link created for 7 days.');
    },
    onError: (mutationError: Error) => toast.error(mutationError.message)
  });

  function resetTaskForm() {
    setTaskTitle('');
    setTaskDescription('');
    setTaskDueDate('');
    setTaskPriority('medium');
    setTaskAssignee('');
    setTaskLabels('');
  }

  function openTaskEditor(task: Task) {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description ?? '');
    setTaskDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '');
    setTaskPriority(task.priority);
    setTaskAssignee(typeof task.assignee === 'object' ? task.assignee?._id ?? '' : '');
    setTaskLabels(task.labels?.join(', ') ?? '');
  }

  const handleCreateTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createTask.mutate();
  };

  const handleUpdateTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTask) return;
    updateTask.mutate({
      taskId: editingTask._id,
      changes: {
        title: taskTitle,
        description: taskDescription,
        dueDate: taskDueDate || undefined,
        priority: taskPriority,
        assignee: taskAssignee || null,
        labels: taskLabels.split(',').map((label) => label.trim()).filter(Boolean)
      }
    });
  };

  const handleInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    inviteByEmail.mutate();
  };

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Link copied.');
    } catch {
      toast.error('Unable to copy. Select and copy the link manually.');
    }
  }

  if (isLoading) return <div className="card">Loading project…</div>;
  if (isError) return <div className="card text-red-600">Error: {error instanceof Error ? error.message : 'Unable to load the project.'}</div>;

  const project = data?.project;
  const metrics = data?.metrics;
  if (!project) return <div className="card">Project not found.</div>;
  const canChangeTaskStatus = (task: Task) => {
    const assigneeId = typeof task.assignee === 'object' ? task.assignee?._id : task.assignee;
    return Boolean(user?._id && assigneeId === user._id);
  };

  return (
    <div className="space-y-8">
      <Link className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-700" to="/projects">
        <ArrowLeft size={16} /> Back to projects
      </Link>

      <section className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-2 h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: project.color || '#4f46e5' }} />
            <div>
              <p className="text-sm font-medium text-indigo-600">Project workspace</p>
              <h2 className="text-3xl font-bold text-slate-900">{project.name}</h2>
              <p className="mt-2 text-slate-600">{project.description || 'No description.'}</p>
              <span className="mt-3 inline-flex badge bg-indigo-50 text-indigo-700">{project.status}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canInvite && (
              <>
                <button className="btn-secondary" onClick={() => { setInviteUrl(''); setShowInviteForm(true); }} type="button">
                  <UserPlus className="mr-2" size={16} /> Invite a member
                </button>
                <button className="btn-secondary" disabled={createShareLink.isPending} onClick={() => createShareLink.mutate()} type="button">
                  <Share2 className="mr-2" size={16} /> {createShareLink.isPending ? 'Creating…' : 'Create a shareable link'}
                </button>
              </>
            )}
            <button className="btn-primary" onClick={() => { resetTaskForm(); setShowTaskForm(true); }} type="button">
              <Plus className="mr-2" size={16} /> Add a task
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Tasks" value={metrics?.totalTasks ?? tasks.length} />
          <Metric label="Completed" value={metrics?.completedTasks ?? 0} />
          <Metric label="Overdue" value={metrics?.overdueTasks ?? tasks.filter(isOverdue).length} />
          <Metric label="Progress" value={`${metrics?.progress ?? 0}%`} />
        </div>
      </section>

      {showInviteForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4">
          <section aria-labelledby="invite-title" aria-modal="true" className="card w-full max-w-xl space-y-5" role="dialog">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold" id="invite-title">Invite people to “{project.name}”</h3>
              <button aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setShowInviteForm(false)} type="button"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-600">The invitation is tied to the address you enter. Automatic email delivery is not configured: copy the generated link and send it by email or using your preferred tool. The link expires after 7 days.</p>
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleInvite}>
              <input aria-label="Member email" className="input flex-1" onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@example.com" required type="email" value={inviteEmail} />
              <button className="btn-primary" disabled={inviteByEmail.isPending} type="submit">{inviteByEmail.isPending ? 'Creating…' : 'Create invitation'}</button>
            </form>
            {inviteUrl && <ShareableLink url={inviteUrl} onCopy={copyInviteLink} />}
          </section>
        </div>
      )}

      {showShareLink && inviteUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section
            aria-labelledby="share-link-title"
            aria-modal="true"
            className="card w-full max-w-xl space-y-5"
            role="dialog"
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-semibold" id="share-link-title">Invitation link is ready</h3>
              <button
                aria-label="Close"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setShowShareLink(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600">Anyone with this link can join “{project.name}” for 7 days. Copy it and share it anywhere.</p>
            <ShareableLink url={inviteUrl} onCopy={copyInviteLink} />
          </section>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><p className="text-sm font-medium text-indigo-600">Project board</p><h3 className="text-2xl font-bold text-slate-900">Tasks by member</h3></div>
          <span className="text-sm text-slate-500">{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</span>
        </div>
        {tasksError ? (
          <div className="card text-red-600">Error: {tasksLoadError instanceof Error ? tasksLoadError.message : 'Unable to load tasks.'}</div>
        ) : tasksLoading ? (
          <div className="card">Loading project tasks…</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {members.map((member, index) => {
              const person = typeof member.user === 'string' ? null : member.user as User;
              const memberId = typeof member.user === 'string' ? member.user : member.user?._id;
              const assignedTasks = tasks.filter((task) => (typeof task.assignee === 'object' ? task.assignee?._id : task.assignee) === memberId);
              const memberName = person?.fullName ?? 'Member';
              return (
                <article aria-label={`${memberName} tasks`} className="rounded-2xl bg-slate-200/70 p-3" key={memberId ?? index}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">{person?.fullName?.[0] ?? '?'}</div>
                    <div className="min-w-0"><h4 className="truncate font-semibold text-slate-900">{memberName}</h4><p className="text-sm text-slate-500">{member.role}</p></div>
                    <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">{assignedTasks.length}</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {assignedTasks.map((task) => (
                      <TaskCard
                        key={task._id}
                        onEdit={() => openTaskEditor(task)}
                        onStatusChange={(nextStatus) => changeStatus.mutate({ taskId: task._id, status: nextStatus })}
                        canChangeStatus={canChangeTaskStatus(task)}
                        statusChanging={changeStatus.isPending && changeStatus.variables?.taskId === task._id}
                        task={task}
                      />
                    ))}
                    {!assignedTasks.length && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">No tasks assigned.</p>}
                  </div>
                </article>
              );
            })}
            <article aria-label="Unassigned tasks" className="rounded-2xl bg-slate-200/70 p-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <h4 className="font-semibold text-slate-800">Unassigned</h4>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">{tasks.filter((task) => !task.assignee).length}</span>
              </div>
              <div className="mt-4 space-y-3">
                {tasks.filter((task) => !task.assignee).map((task) => (
                    <TaskCard
                      key={task._id}
                      onEdit={() => openTaskEditor(task)}
                      onStatusChange={(nextStatus) => changeStatus.mutate({ taskId: task._id, status: nextStatus })}
                      canChangeStatus={canChangeTaskStatus(task)}
                      statusChanging={changeStatus.isPending && changeStatus.variables?.taskId === task._id}
                      task={task}
                    />
                ))}
                {!tasks.some((task) => !task.assignee) && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">No unassigned tasks.</p>}
              </div>
            </article>
          </div>
        )}
      </section>

      {(showTaskForm || editingTask) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <section aria-labelledby="task-form-title" aria-modal="true" className="card my-auto w-full max-w-2xl space-y-4" role="dialog">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold" id="task-form-title">{editingTask ? 'Edit task' : 'Add a task to the project'}</h3>
              <button aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => { setEditingTask(null); setShowTaskForm(false); }} type="button"><X size={18} /></button>
            </div>
            <TaskForm
              assignee={taskAssignee}
              description={taskDescription}
              dueDate={taskDueDate}
              isPending={createTask.isPending || updateTask.isPending}
              labels={taskLabels}
              members={members}
              onAssigneeChange={setTaskAssignee}
              onDescriptionChange={setTaskDescription}
              onDueDateChange={setTaskDueDate}
              onLabelsChange={setTaskLabels}
              onPriorityChange={setTaskPriority}
              onStatusChange={(status) => { if (editingTask) updateTask.mutate({ taskId: editingTask._id, changes: { status } }); }}
              onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
              onTitleChange={setTaskTitle}
              priority={taskPriority}
              status={editingTask?.status}
              canChangeStatus={editingTask ? canChangeTaskStatus(editingTask) : false}
              title={taskTitle}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>;
}

function ShareableLink({ url, onCopy }: { url: string; onCopy: () => void }) {
  return (
    <div className="flex min-w-0 flex-1 gap-2 sm:max-w-xl">
      <input aria-label="Invitation link to share" className="input min-w-0" readOnly value={url} />
      <button aria-label="Copy invitation link" className="btn-secondary shrink-0" onClick={onCopy} type="button"><Copy size={16} /></button>
    </div>
  );
}

function TaskCard({
  task,
  onEdit,
  onStatusChange,
  canChangeStatus,
  statusChanging
}: {
  task: Task;
  onEdit: () => void;
  onStatusChange: (status: Task['status']) => void;
  canChangeStatus: boolean;
  statusChanging: boolean;
}) {
  const assignee = typeof task.assignee === 'object' ? task.assignee : null;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <button className="min-w-0 flex-1 text-left font-semibold text-slate-900 hover:text-indigo-700" onClick={onEdit} type="button">{task.title}</button>
        <select
          aria-label={`Status of ${task.title}`}
          className="max-w-32 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
          disabled={!canChangeStatus || statusChanging}
          onChange={(event) => onStatusChange(event.target.value as Task['status'])}
          title={canChangeStatus ? undefined : 'Only the assigned member can change this status.'}
          value={task.status}
        >
          {taskStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
      </div>
      {isOverdue(task) && <span className="mt-2 inline-flex badge bg-red-50 text-red-700">Overdue</span>}
      {task.description && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{task.description}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(task.labels ?? []).map((label, index) => <span className="badge bg-violet-50 text-violet-700" key={`${task._id}-${label}-${index}`}>{label}</span>)}
        <span className="badge bg-amber-50 text-amber-700">{task.priority}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
          {assignee && <span className="truncate">{assignee.fullName}</span>}
          {task.dueDate && <span className="flex shrink-0 items-center gap-1"><CalendarDays size={13} />{new Date(task.dueDate).toLocaleDateString('en-US')}</span>}
        </div>
      </div>
      <button className="mt-3 text-xs font-medium text-indigo-700 hover:underline" onClick={onEdit} type="button">Edit task</button>
    </article>
  );
}

function TaskForm({
  title,
  description,
  dueDate,
  priority,
  assignee,
  labels,
  status,
  canChangeStatus,
  members,
  isPending,
  onTitleChange,
  onDescriptionChange,
  onDueDateChange,
  onPriorityChange,
  onAssigneeChange,
  onLabelsChange,
  onStatusChange,
  onSubmit
}: {
  title: string;
  description: string;
  dueDate: string;
  priority: Task['priority'];
  assignee: string;
  labels: string;
  status?: Task['status'];
  canChangeStatus: boolean;
  members: NonNullable<Project['members']>;
  isPending: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onPriorityChange: (value: Task['priority']) => void;
  onAssigneeChange: (value: string) => void;
  onLabelsChange: (value: string) => void;
  onStatusChange: (value: Task['status']) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
      <label className="text-sm font-medium text-slate-700 md:col-span-2">Task title
        <input aria-label="Task title" className="input mt-1" maxLength={180} minLength={3} onChange={(event) => onTitleChange(event.target.value)} required value={title} />
      </label>
      <label className="text-sm font-medium text-slate-700 md:col-span-2">Description
        <textarea className="input mt-1" maxLength={4000} onChange={(event) => onDescriptionChange(event.target.value)} rows={3} value={description} />
      </label>
      {status && <label className="text-sm font-medium text-slate-700">Status
        <select aria-label="Edit status" className="input mt-1" disabled={!canChangeStatus} onChange={(event) => onStatusChange(event.target.value as Task['status'])} title={canChangeStatus ? undefined : 'Only the assigned member can change this status.'} value={status}>
          {taskStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {!canChangeStatus && <span className="mt-1 block text-xs font-normal text-slate-500">Only the assigned member can change the status.</span>}
      </label>}
      <label className="text-sm font-medium text-slate-700">Priority
        <select className="input mt-1" onChange={(event) => onPriorityChange(event.target.value as Task['priority'])} value={priority}>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">Assignee
        <select className="input mt-1" onChange={(event) => onAssigneeChange(event.target.value)} value={assignee}>
          <option value="">Unassigned</option>
          {members.map((member) => {
            const person = typeof member.user === 'string' ? null : member.user as User;
            const memberId = typeof member.user === 'string' ? member.user : member.user?._id ?? '';
            return <option key={memberId} value={memberId}>{person?.fullName ?? person?.email ?? 'Member'}</option>;
          })}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">Due date
        <input className="input mt-1" onChange={(event) => onDueDateChange(event.target.value)} type="date" value={dueDate} />
      </label>
      <label className="text-sm font-medium text-slate-700">Labels (comma-separated)
        <input aria-label="Labels" className="input mt-1" maxLength={500} onChange={(event) => onLabelsChange(event.target.value)} placeholder="Design, Urgent" value={labels} />
      </label>
      <div className="flex justify-end gap-3 md:col-span-2">
        <button className="btn-primary" disabled={isPending} type="submit">{isPending ? 'Saving…' : status ? 'Save task' : 'Add task'}</button>
      </div>
    </form>
  );
}

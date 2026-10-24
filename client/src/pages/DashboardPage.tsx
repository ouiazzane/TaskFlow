import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, Clock3, FolderKanban } from 'lucide-react';
import { api } from '../api';

export function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/summary');
      return data.data.summary;
    }
  });

  const tasksByStatus = (data?.tasksByStatus ?? {}) as Record<string, number>;
  const totalTasks = Object.values(tasksByStatus).reduce((total, count) => total + Number(count), 0);

  const statCards = [
    { label: 'Projects', value: data?.totalProjects ?? 0, icon: FolderKanban, accent: 'bg-indigo-50 text-indigo-600' },
    { label: 'Tasks assigned to you', value: data?.tasksAssignedToUser ?? 0, icon: BriefcaseBusiness, accent: 'bg-sky-50 text-sky-600' },
    { label: 'Completed', value: data?.completedTasks ?? 0, icon: CheckCircle2, accent: 'bg-emerald-50 text-emerald-600' },
    { label: 'Overdue', value: data?.overdueTasks ?? 0, icon: AlertTriangle, accent: 'bg-amber-50 text-amber-600' }
  ];

  if (isLoading) return <div className="card">Loading dashboard…</div>;
  if (isError) return <div className="card text-red-600">Error: {error instanceof Error ? error.message : 'Unable to load the dashboard.'}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Overview</p>
          <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent}`}>
                <Icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Tasks by status</h3>
          <div className="space-y-3">
            {Object.entries(tasksByStatus).map(([status, count]) => {
              const total = Math.max(totalTasks, 1);
              return (
                <div key={status}>
                  <div className="mb-1 flex justify-between text-sm text-slate-600">
                    <span>{status === 'todo' ? 'To do' : status === 'in_progress' ? 'In progress' : status === 'in_review' ? 'In review' : 'Done'}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div className="h-2.5 rounded-full bg-indigo-500" style={{ width: `${((Number(count) / total) * 100).toFixed(0)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Deadlines</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-amber-700">
              <Clock3 size={18} />
              <span>{data?.dueSoonTasks ?? 0} tasks due soon</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-emerald-700">
              <CheckCircle2 size={18} />
              <span>{data?.completedTasks ?? 0} tasks completed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

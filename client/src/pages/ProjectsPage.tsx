import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderPlus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api';
import type { Project } from '../types';

type ProjectStatus = 'all' | Project['status'];

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { data, isLoading, isError, error } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await api.get('/projects');
      return data.data.projects;
    }
  });
  const createProject = useMutation({
    mutationFn: async (project: { name: string; description: string }) => {
      const { data } = await api.post('/projects', project);
      return data.data.project as Project;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCreateOpen(false);
      setName('');
      setDescription('');
      toast.success('Project created.');
    },
    onError: (mutationError: Error) => toast.error(mutationError.message)
  });

  const projects = (data ?? []).filter((project) => {
    const matchesSearch = `${project.name} ${project.description ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase());
    return matchesSearch && (status === 'all' || project.status === status);
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createProject.mutate({ name, description });
  };

  if (isLoading) return <div className="card">Loading projects…</div>;
  if (isError) return <div className="card text-red-600">Error: {error instanceof Error ? error.message : 'Unable to load projects.'}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Workspace</p>
          <h2 className="text-3xl font-bold text-slate-900">Projects</h2>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <FolderPlus size={16} className="mr-2" />
          New project
        </button>
      </div>

      <div className="card flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} />
          <input
            aria-label="Search projects"
            className="input pl-10"
            placeholder="Search projects..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <label className="btn-secondary gap-2">
          <SlidersHorizontal size={16} />
          <span>Filters</span>
          <select aria-label="Filter projects by status" className="bg-transparent outline-none" value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      {projects.length ? (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link key={project._id} to={`/projects/${project._id}`} className="card block transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color || '#4f46e5' }} />
                  <h3 className="text-lg font-semibold text-slate-900">{project.name}</h3>
                </div>
                <span className="badge bg-indigo-50 text-indigo-700">{project.status === 'active' ? 'Active' : project.status === 'completed' ? 'Completed' : 'Archived'}</span>
              </div>
              <p className="line-clamp-3 text-sm text-slate-600">{project.description || 'No description.'}</p>
              <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
                <span>{project.members?.length || 0} members</span>
                <span>{project.dueDate ? new Date(project.dueDate).toLocaleDateString('en-US') : 'No due date'}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card text-center text-slate-500">{search || status !== 'all' ? 'No projects match these filters.' : 'No projects yet.'}</div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/50 p-4">
          <section aria-labelledby="create-project-title" aria-modal="true" className="card w-full max-w-lg space-y-4" role="dialog">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold" id="create-project-title">Create a project</h3>
              <button aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setCreateOpen(false)} type="button"><X size={18} /></button>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-slate-700">
                Project name
                <input autoFocus className="input mt-1" maxLength={120} minLength={3} onChange={(event) => setName(event.target.value)} required value={name} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Description
                <textarea className="input mt-1" maxLength={2000} onChange={(event) => setDescription(event.target.value)} rows={3} value={description} />
              </label>
              <div className="flex justify-end gap-3">
                <button className="btn-secondary" onClick={() => setCreateOpen(false)} type="button">Cancel</button>
                <button className="btn-primary" disabled={createProject.isPending} type="submit">
                  {createProject.isPending ? 'Creating…' : 'Create project'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

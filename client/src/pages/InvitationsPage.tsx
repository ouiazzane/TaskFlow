import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api';
import type { Project, User } from '../types';

type PendingInvitation = {
  _id: string;
  expiresAt: string;
  project: Pick<Project, '_id' | 'name' | 'description'>;
  createdBy: Pick<User, 'fullName' | 'email'>;
};

export function InvitationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery<PendingInvitation[]>({
    queryKey: ['pending-invitations'],
    queryFn: async () => {
      const { data } = await api.get('/invitations/pending');
      return data.data.invitations;
    }
  });
  const acceptInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { data } = await api.post(`/invitations/${invitationId}/accept`);
      return data.data.projectId as string;
    },
    onSuccess: async (projectId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pending-invitations'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      ]);
      toast.success('You joined the project.');
      window.location.assign(`/projects/${projectId}`);
    },
    onError: (mutationError: Error) => toast.error(mutationError.message)
  });

  if (isLoading) return <div className="card">Loading invitations…</div>;
  if (isError) return <div className="card text-red-600">Error: {error instanceof Error ? error.message : 'Unable to load invitations.'}</div>;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-indigo-600">Collaboration</p>
        <h2 className="text-3xl font-bold text-slate-900">Project invitations</h2>
      </header>
      {data?.length ? data.map((invitation) => (
        <article className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" key={invitation._id}>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{invitation.project.name}</h3>
            <p className="mt-1 text-sm text-slate-600">
              Invited by {invitation.createdBy.fullName} · expires {new Date(invitation.expiresAt).toLocaleDateString('en-US')}
            </p>
            {invitation.project.description && <p className="mt-2 text-sm text-slate-500">{invitation.project.description}</p>}
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={acceptInvitation.isPending} onClick={() => acceptInvitation.mutate(invitation._id)} type="button">
              <Check className="mr-2" size={16} />
              Accept
            </button>
          </div>
        </article>
      )) : (
        <div className="card flex items-center gap-3 text-slate-600">
          <FolderOpen className="text-slate-400" />
          No pending invitations for this email address.
        </div>
      )}
    </div>
  );
}

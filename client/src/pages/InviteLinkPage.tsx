import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Users } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api';

type InvitationPreview = {
  project: { _id: string; name: string; description?: string };
  invitedEmail: string | null;
  alreadyMember: boolean;
  expiresAt: string;
};

export function InviteLinkPage() {
  const { token = '' } = useParams();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery<InvitationPreview>({
    queryKey: ['invitation-link', token],
    queryFn: async () => {
      const { data } = await api.post('/invitations/link-preview', { token });
      return data.data;
    },
    enabled: Boolean(token)
  });
  const acceptInvitation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/invitations/accept-link', { token });
      return data.data.projectId as string;
    },
    onSuccess: async (projectId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['pending-invitations'] })
      ]);
      window.location.assign(`/projects/${projectId}`);
    },
    onError: (mutationError: Error) => toast.error(mutationError.message)
  });

  if (isLoading) return <div className="card m-8">Checking invitation link…</div>;
  if (isError || !data) return <div className="card m-8 text-red-600">Invitation unavailable: {error instanceof Error ? error.message : 'Invalid or expired link.'}</div>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="card w-full max-w-xl space-y-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><Users /></div>
        <div>
          <p className="text-sm font-medium text-indigo-600">TaskFlow invitation</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Join {data.project.name}</h1>
          {data.project.description && <p className="mt-2 text-slate-600">{data.project.description}</p>}
          <p className="mt-3 text-sm text-slate-500">This link expires on {new Date(data.expiresAt).toLocaleDateString('en-US')}.</p>
          {data.invitedEmail && <p className="mt-1 text-sm text-slate-500">For: {data.invitedEmail}</p>}
        </div>
        {data.alreadyMember ? (
          <a className="btn-primary" href={`/projects/${data.project._id}`}>Open project</a>
        ) : (
          <button className="btn-primary" disabled={acceptInvitation.isPending} onClick={() => acceptInvitation.mutate()} type="button">
            <Check className="mr-2" size={16} />
            {acceptInvitation.isPending ? 'Joining…' : 'Accept and join'}
          </button>
        )}
      </section>
    </main>
  );
}

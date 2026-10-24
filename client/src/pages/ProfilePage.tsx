import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Save, UserRound, X } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { api } from '../api';

const maxAvatarLength = 85_000;

async function compressAvatar(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('The photo must be smaller than 5 MB.');
  }

  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to read this image.'));
      image.src = source;
    });

    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - side) / 2;
    const sourceY = (image.naturalHeight - side) / 2;
    for (const dimension of [256, 192, 128]) {
      const canvas = document.createElement('canvas');
      canvas.width = dimension;
      canvas.height = dimension;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Photo processing is not available in this browser.');
      context.drawImage(image, sourceX, sourceY, side, side, 0, 0, dimension, dimension);
      for (const quality of [0.82, 0.68, 0.54]) {
        const compressed = canvas.toDataURL('image/jpeg', quality);
        if (compressed.length <= maxAvatarLength) return compressed;
      }
    }
    throw new Error('This photo cannot be compressed enough. Choose another image.');
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get('/auth/me');
      return data.data.user;
    }
  });

  const [fullName, setFullName] = useState(data?.fullName || '');
  const [jobTitle, setJobTitle] = useState(data?.jobTitle || '');
  const [bio, setBio] = useState(data?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(data?.avatarUrl || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setFullName(data.fullName || '');
      setJobTitle(data.jobTitle || '');
      setBio(data.bio || '');
      setAvatarUrl(data.avatarUrl || '');
    }
  }, [data]);

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      setAvatarUrl(await compressAvatar(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to load this photo.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: response } = await api.patch('/auth/me', { fullName, jobTitle, bio, avatarUrl });
      queryClient.setQueryData(['me'], response.data.user);
      toast.success('Profile updated.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="card">Loading profile…</div>;
  if (isError) return <div className="card text-red-600">Error: {error instanceof Error ? error.message : 'Unable to load profile.'}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-indigo-600">Account</p>
        <h2 className="text-3xl font-bold text-slate-900">Profile and settings</h2>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="h-32 bg-gradient-to-r from-indigo-600 via-violet-500 to-sky-400" />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-14 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="relative h-28 w-28 shrink-0">
              <img
                alt={`Profile photo of ${data?.fullName ?? 'the user'}`}
                className="h-28 w-28 rounded-3xl border-4 border-white bg-white object-cover shadow-md"
                onError={(event) => { event.currentTarget.src = '/default-avatar.svg'; }}
                src={avatarUrl || '/default-avatar.svg'}
              />
              <label className="absolute -bottom-2 -right-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow hover:bg-indigo-700" title="Choose a profile photo">
                <Camera size={17} />
                <input accept="image/jpeg,image/png,image/webp" aria-label="Choose a profile photo" className="sr-only" onChange={handleAvatarChange} type="file" />
              </label>
            </div>
            <div className="min-w-0 pb-1">
              <h3 className="truncate text-2xl font-bold text-slate-900">{fullName || 'Your profile'}</h3>
              <p className="truncate text-sm text-slate-500">{data?.email}</p>
            </div>
            {avatarUrl && (
              <button className="text-sm font-medium text-slate-500 hover:text-red-600 sm:mb-2 sm:ml-auto" onClick={() => setAvatarUrl('')} type="button">
                <X className="mr-1 inline" size={15} />Remove photo
              </button>
            )}
          </div>

          <p className="mt-4 text-sm text-slate-500">JPG, PNG, or WebP. The photo is cropped and compressed before it is saved.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Full name</span>
              <input maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Job title</span>
              <input maxLength={120} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="input" placeholder="Product Designer" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">About</span>
              <textarea className="input" maxLength={1000} onChange={(e) => setBio(e.target.value)} placeholder="Tell us a little about yourself…" rows={4} value={bio} />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button disabled={saving} onClick={handleSave} className="btn-primary">
              <Save className="mr-2" size={16} />{saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </div>
      </section>

      <section className="card flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><UserRound size={18} /></div>
        <div>
          <h3 className="font-semibold text-slate-900">TaskFlow account</h3>
          <p className="mt-1 text-sm text-slate-500">Sign-in email: {data?.email}</p>
          <p className="mt-1 text-xs text-slate-400">The default photo is stored locally; no image is loaded from a third-party network.</p>
        </div>
      </section>
    </div>
  );
}

import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../api';
import { PublicNavbar } from '../components/PublicNavbar';

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      queryClient.setQueryData(['me'], data.data.user);
      toast.success('Your account has been created.');
      navigate(location.state?.from?.pathname ? `${location.state.from.pathname}${location.state.from.search ?? ''}${location.state.from.hash ?? ''}` : '/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <PublicNavbar />
      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 font-bold text-white">T</div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Create an account</h1>
          <p className="mt-2 text-sm text-slate-500">Bring your team together and organize your work.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Full name</span>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} />
              <input value={form.fullName} onChange={(e) => handleChange('fullName', e.target.value)} className="input pl-10" placeholder="Alex Morgan" required />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} />
              <input value={form.email} onChange={(e) => handleChange('email', e.target.value)} className="input pl-10" type="email" placeholder="alex@example.com" required />
            </div>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} />
                <input value={form.password} onChange={(e) => handleChange('password', e.target.value)} className="input pl-10 pr-10" type={showPassword ? 'text' : 'password'} required />
                <button type="button" onClick={() => setShowPassword((state) => !state)} className="absolute right-3 top-3 text-slate-500">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Confirm password</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} />
                <input value={form.confirmPassword} onChange={(e) => handleChange('confirmPassword', e.target.value)} className="input pl-10" type={showPassword ? 'text' : 'password'} required />
              </div>
            </label>
          </div>

          <button disabled={loading} className="btn-primary w-full" type="submit">
            {loading ? 'Creating account…' : 'Create my account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="font-semibold text-indigo-600">
            Sign in
          </Link>
        </p>
      </div>
      </main>
    </div>
  );
}

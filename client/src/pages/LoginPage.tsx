import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../api';
import { PublicNavbar } from '../components/PublicNavbar';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      queryClient.setQueryData(['me'], data.data.user);
      toast.success('You are signed in.');
      navigate(location.state?.from?.pathname ? `${location.state.from.pathname}${location.state.from.search ?? ''}${location.state.from.hash ?? ''}` : '/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <PublicNavbar />
      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 font-bold text-white">T</div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Sign in</h1>
          <p className="mt-2 text-sm text-slate-500">Access your TaskFlow workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-10" type="email" placeholder="name@company.com" required />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} />
              <input value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-10 pr-10" type={showPassword ? 'text' : 'password'} placeholder="••••••••" required />
              <button type="button" onClick={() => setShowPassword((state) => !state)} className="absolute right-3 top-3 text-slate-500">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <button disabled={loading} className="btn-primary w-full" type="submit">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don’t have an account?{' '}
          <Link to="/register" state={location.state} className="font-semibold text-indigo-600">
            Create an account
          </Link>
        </p>
      </div>
      </main>
    </div>
  );
}

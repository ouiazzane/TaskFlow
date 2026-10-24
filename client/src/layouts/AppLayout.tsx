import { Bell, BriefcaseBusiness, FolderKanban, LayoutDashboard, LogOut, Settings, UserCircle2, UserPlus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, NavLink } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api';
import { useAuth } from '../auth';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/tasks', label: 'Tasks', icon: BriefcaseBusiness },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/invitations', label: 'Invitations', icon: UserPlus },
  { to: '/profile', label: 'Profile', icon: UserCircle2 }
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
      toast.success('You have been signed out.');
      queryClient.clear();
      window.location.replace('/');
    } catch {
      toast.error('Unable to sign out.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-slate-950 p-5 text-slate-100 lg:flex lg:flex-col">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500 font-bold text-white">T</div>
          <div>
            <p className="text-lg font-semibold">TaskFlow</p>
            <p className="text-xs text-slate-400">Workspace</p>
          </div>
        </div>

        <nav className="space-y-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
              {user?.fullName?.[0] || 'U'}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user?.fullName || 'User'}</p>
              <p className="text-xs text-slate-400">{user?.email || 'email@example.com'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-secondary w-full justify-center border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800">
            <LogOut size={16} className="mr-2" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-sm font-medium text-indigo-600">TaskFlow</p>
              <h1 className="text-xl font-semibold text-slate-900">Workspace</h1>
            </div>

            <div className="flex items-center gap-3">
              <Link className="btn-secondary" to="/profile">
                <Settings size={16} className="mr-2" />
               Profile & settings
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

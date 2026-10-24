import { ArrowRight, Layers3 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PublicNavbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link aria-label="TaskFlow home" className="flex items-center gap-3" to="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
            <Layers3 size={21} />
          </span>
          <span className="text-xl font-bold tracking-tight text-slate-950">TaskFlow</span>
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-6">
          <a className="hidden text-sm font-medium text-slate-600 transition hover:text-indigo-700 sm:inline" href="/#features">Features</a>
          <Link className="text-sm font-semibold text-slate-700 transition hover:text-indigo-700" to="/login">Sign in</Link>
          <Link className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 sm:px-4" to="/register">
            <span className="hidden sm:inline">Create an account</span>
            <span className="sm:hidden">Get started</span>
            <ArrowRight size={16} />
          </Link>
        </nav>
      </div>
    </header>
  );
}

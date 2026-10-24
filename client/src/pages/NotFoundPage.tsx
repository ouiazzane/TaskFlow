import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="card max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">404</p>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-3 text-slate-600">The requested page does not exist or is no longer available.</p>
        <Link to="/" className="btn-primary mt-6">Back to home</Link>
      </div>
    </div>
  );
}

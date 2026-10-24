export function PageShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-indigo-600">{subtitle || 'Vue'}</p>
        <h2 className="text-3xl font-bold text-slate-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

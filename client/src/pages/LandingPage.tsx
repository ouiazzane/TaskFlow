import {
  ArrowDown,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  FolderKanban,
  Layers3,
  ListTodo,
  MessageCircle,
  Sparkles,
  Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PublicNavbar } from '../components/PublicNavbar';

const features = [
  {
    icon: FolderKanban,
    number: '01',
    title: 'A space for every project',
    description: 'Keep every project’s tasks, members, and deadlines together in one place.'
  },
  {
    icon: ListTodo,
    number: '02',
    title: 'A board that is easy to follow',
    description: 'See what is to do, in progress, in review, or done, and update task statuses as work moves forward.'
  },
  {
    icon: Users,
    number: '03',
    title: 'A team that moves forward together',
    description: 'Assign tasks to members and invite collaborators by email or with a shareable link.'
  },
  {
    icon: Bell,
    number: '04',
    title: 'Keep deadlines in sight',
    description: 'Add due dates, priorities, and labels to know what to work on next.'
  }
];

const previewTasks = [
  { title: 'Prepare the project brief', status: 'To do', statusClass: 'bg-slate-100 text-slate-600', initials: 'ML', person: 'Marie L.' },
  { title: 'Design the home page', status: 'In progress', statusClass: 'bg-blue-50 text-blue-700', initials: 'AD', person: 'Amine D.' },
  { title: 'Review team feedback', status: 'In review', statusClass: 'bg-violet-50 text-violet-700', initials: 'SL', person: 'Sarah L.' }
];

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-white text-slate-900">
      <PublicNavbar />

      <main>
        <section className="relative isolate">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -right-40 -top-28 h-[34rem] w-[34rem] rounded-full bg-indigo-100/70 blur-3xl" />
            <div className="absolute -left-48 top-64 h-[28rem] w-[28rem] rounded-full bg-sky-100/60 blur-3xl" />
          </div>
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3.5 py-2 text-sm font-semibold text-indigo-700 shadow-sm">
                <Sparkles size={16} />
                Teamwork, without the clutter
              </div>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Your projects move forward.
                <span className="mt-2 block bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">So does your team.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                Organize projects, assign tasks, and track progress in a shared workspace that is clear and easy to use.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-indigo-200/70 transition hover:-translate-y-0.5 hover:bg-indigo-500" to="/register">
                  Create your free workspace
                  <ArrowRight size={18} />
                </Link>
                <a className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-5 py-3.5 font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-white hover:text-indigo-700" href="#features">
                  Explore TaskFlow
                  <ArrowDown size={17} />
                </a>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="text-emerald-600" size={17} />Projects and tasks in one place</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="text-emerald-600" size={17} />Collaborate through invitations</span>
              </div>
            </div>

            <div aria-label="Illustrative preview of a TaskFlow project board" className="relative mx-auto w-full max-w-2xl">
              <div aria-hidden="true" className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-indigo-200/70 via-white to-sky-200/70 blur-xl" />
              <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-indigo-950/10">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><FolderKanban size={20} /></div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Project</p>
                      <h2 className="font-semibold text-slate-900">Website redesign</h2>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">In progress</span>
                </div>

                <div className="grid grid-cols-3 gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:gap-4 sm:px-6">
                  <div className="rounded-xl border border-slate-100 bg-white p-3">
                    <p className="text-xs text-slate-500">Tasks</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">12</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-3">
                    <p className="text-xs text-slate-500">Completed</p>
                    <p className="mt-1 text-xl font-bold text-emerald-600">5</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-3">
                    <p className="text-xs text-slate-500">Team</p>
                    <div className="mt-1 flex items-center">
                      {['ML', 'AD', 'SL'].map((initials, index) => (
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white ${index === 0 ? 'bg-indigo-500' : index === 1 ? 'bg-violet-500' : 'bg-sky-600'} ${index ? '-ml-2' : ''}`} key={initials}>{initials}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Project board</h3>
                    <span className="text-xs font-medium text-slate-400">Recently updated</span>
                  </div>
                  <div className="space-y-3">
                    {previewTasks.map((task) => (
                      <article className="rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-200 hover:shadow-sm" key={task.title}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-medium text-slate-800">{task.title}</h4>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${task.statusClass}`}>{task.status}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">{task.initials}</span>
                            {task.person}
                          </div>
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays size={14} />This week</span>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-indigo-50/70 px-4 py-3 text-sm">
                    <span className="font-medium text-indigo-900">Everyone knows what to do.</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-indigo-600"><Check size={16} /></span>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-lg sm:flex">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={20} /></span>
                <div><p className="text-xs text-slate-500">Progress at a glance</p><p className="text-sm font-semibold text-slate-900">One project, one clear view</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-100 bg-slate-50/80">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 text-center sm:px-6 md:flex-row md:items-center md:justify-between md:text-left lg:px-8">
            <p className="font-semibold text-slate-800">Everything you need to keep work moving.</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm font-medium text-slate-500 md:justify-end">
              <span className="inline-flex items-center gap-2"><FolderKanban size={16} />Projects</span>
              <span className="inline-flex items-center gap-2"><CircleDashed size={16} />Statuses</span>
              <span className="inline-flex items-center gap-2"><Users size={16} />Team</span>
              <span className="inline-flex items-center gap-2"><Clock3 size={16} />Deadlines</span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8" id="features">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
              <Sparkles size={14} />Easy to get started
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">A workspace designed to move work forward</h2>
            <p className="mt-4 leading-7 text-slate-600">From project kickoff to the final task, keep your team and priorities aligned.</p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {features.map(({ icon: Icon, number, title, description }) => (
              <article className="group rounded-2xl border border-slate-200 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-950/5" key={title}>
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white"><Icon size={22} /></span>
                  <span className="text-sm font-bold tracking-wider text-slate-300">{number}</span>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-12 text-center sm:px-12 sm:py-16">
            <div aria-hidden="true" className="absolute -right-20 -top-40 h-96 w-96 rounded-full bg-indigo-600/40 blur-3xl" />
            <div aria-hidden="true" className="absolute -bottom-56 left-1/4 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />
            <div className="relative mx-auto max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-indigo-100"><MessageCircle size={15} />Ready to collaborate?</span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">Give your projects a real starting point.</h2>
              <p className="mt-4 leading-7 text-slate-300">Create your TaskFlow workspace and bring your team together around the work ahead.</p>
              <Link className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 font-semibold text-indigo-700 transition hover:bg-indigo-50" to="/register">
                Create an account
                <ChevronRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <Link aria-label="TaskFlow home" className="flex items-center gap-2.5" to="/">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white"><Layers3 size={17} /></span>
            <span className="font-bold text-slate-900">TaskFlow</span>
          </Link>
          <p className="text-sm text-slate-500">Organize work. Move your projects forward.</p>
          <div className="flex gap-5 text-sm font-medium text-slate-600">
            <Link className="hover:text-indigo-700" to="/login">Sign in</Link>
            <Link className="hover:text-indigo-700" to="/register">Create an account</Link>
          </div>
        </div>
        <div className="border-t border-slate-200/80 py-4 text-center text-xs text-slate-400">© {new Date().getFullYear()} TaskFlow</div>
      </footer>
    </div>
  );
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { AppLayout } from '../layouts/AppLayout';
import { LandingPage } from './LandingPage';
import { ProjectsPage } from './ProjectsPage';
import { ProjectDetailPage } from './ProjectDetailPage';
import { InviteLinkPage } from './InviteLinkPage';
import { NotificationsPage } from './NotificationsPage';
import { ProfilePage } from './ProfilePage';
import { TasksPage } from './TasksPage';

vi.mock('../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn()
  }
}));

vi.mock('../auth', () => ({
  useAuth: () => ({ user: { _id: 'user-1', fullName: 'Alice Dupont', email: 'alice@example.com' }, refetchUser: vi.fn() })
}));

const projects = [
  { _id: 'project-1', name: 'Website refresh', description: 'Public site', status: 'active', members: [] },
  { _id: 'project-2', name: 'Mobile app', description: 'iOS release', status: 'archived', members: [] }
];

function renderPage(page: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {page}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderProjectDetailPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/project-1']}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Work pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('presents the public landing page in English with working account links', () => {
    renderPage(<LandingPage />);

    expect(screen.getByRole('heading', { name: 'Your projects move forward. So does your team.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create your free workspace' })).toHaveAttribute('href', '/register');
    expect(screen.getAllByRole('link', { name: 'Sign in' }).every((link) => link.getAttribute('href') === '/login')).toBe(true);
    expect(screen.getAllByRole('link', { name: 'Features' }).some((link) => link.getAttribute('href') === '#features' || link.getAttribute('href') === '/#features')).toBe(true);
    expect(screen.getByRole('heading', { name: 'A workspace designed to move work forward' })).toBeInTheDocument();
  });

  it('searches and filters projects by status', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { projects } } } as never);
    renderPage(<ProjectsPage />);

    expect(await screen.findByText('Website refresh')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search projects' }), { target: { value: 'mobile' } });
    expect(screen.getByText('Mobile app')).toBeInTheDocument();
    expect(screen.queryByText('Website refresh')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter projects by status' }), { target: { value: 'active' } });
    expect(screen.getByText('No projects match these filters.')).toBeInTheDocument();
  });

  it('creates a project from the project dialog', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { projects: [] } } } as never);
    vi.mocked(api.post).mockResolvedValue({ data: { data: { project: { _id: 'new-project' } } } } as never);
    renderPage(<ProjectsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'New project' }));
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Release planning' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Plan the next release' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/projects', {
      name: 'Release planning',
      description: 'Plan the next release'
    }));
    expect(await screen.findByText('No projects yet.')).toBeInTheDocument();
  });

  it('searches and filters tasks by status', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data: {
        data: url === '/tasks'
          ? {
              tasks: [
                { _id: 'task-1', title: 'Prepare launch', status: 'todo', priority: 'high', project: { _id: 'project-1', name: 'Website refresh' } },
                { _id: 'task-2', title: 'Review release', status: 'done', priority: 'medium', project: { _id: 'project-2', name: 'Mobile app' } }
              ]
            }
          : { projects }
      }
    } as never));
    renderPage(<TasksPage />);

    expect(await screen.findByText('Prepare launch')).toBeInTheDocument();
    expect(screen.getAllByText('To do').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Website refresh').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mobile app').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter tasks by status' }), { target: { value: 'done' } });
    expect(await screen.findByText('Review release')).toBeInTheDocument();
    expect(screen.getAllByText('Done').length).toBeGreaterThan(0);
    expect(screen.queryByText('Prepare launch')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter tasks by project' }), { target: { value: 'project-1' } });
    expect(screen.getByText('No tasks match these filters.')).toBeInTheDocument();
  });

  it('updates a task status directly from its project-grouped task list', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data: {
        data: url === '/tasks'
          ? { tasks: [{ _id: 'task-1', title: 'Prepare launch', status: 'todo', priority: 'high', project: { _id: 'project-1', name: 'Website refresh' } }] }
          : { projects }
      }
    } as never));
    vi.mocked(api.patch).mockResolvedValue({ data: { data: { task: {} } } } as never);
    renderPage(<TasksPage />);

    fireEvent.change(await screen.findByRole('combobox', { name: 'Change status of Prepare launch' }), { target: { value: 'done' } });

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/projects/project-1/tasks/task-1/status', { status: 'done' }));
  });

  it('creates a task in the selected project', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data: {
        data: url === '/tasks'
          ? { tasks: [] }
          : {
              projects: [
                {
                  ...projects[0],
                  members: [{ user: { _id: 'user-1', fullName: 'Alice Dupont', email: 'alice@example.com' }, role: 'owner' }]
                },
                projects[1]
              ]
            }
      }
    } as never));
    vi.mocked(api.post).mockResolvedValue({ data: { data: { task: { _id: 'new-task' } } } } as never);
    renderPage(<TasksPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'New task' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Project' }), { target: { value: 'project-1' } });
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'Prepare demo' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Prepare the product demo' } });
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'high' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-11-15' } });
    fireEvent.change(screen.getByLabelText('Assignee'), { target: { value: 'user-1' } });
    fireEvent.change(screen.getByLabelText('Labels'), { target: { value: 'Demo, Release' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/projects/project-1/tasks', {
      title: 'Prepare demo',
      description: 'Prepare the product demo',
      dueDate: '2026-11-15',
      priority: 'high',
      assignee: 'user-1',
      labels: ['Demo', 'Release']
    }));
    expect(await screen.findByText('No tasks yet.')).toBeInTheDocument();
  });

  it('shows a project-fetch error instead of reporting that there are no projects', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/projects') throw new Error('Project service unavailable');
      return { data: { data: { tasks: [] } } } as never;
    });
    renderPage(<TasksPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'New task' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Project service unavailable');
  });

  it('groups project tasks by member and updates each task status inline', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data: {
        data: url === '/projects/project-1'
          ? {
              project: {
                ...projects[0],
                members: [
                  { user: { _id: 'user-1', fullName: 'Alice Dupont', email: 'alice@example.com' }, role: 'owner' },
                  { user: { _id: 'user-2', fullName: 'Bob Martin', email: 'bob@example.com' }, role: 'member' }
                ]
              },
              metrics: { totalTasks: 1, completedTasks: 0, overdueTasks: 0, progress: 0 }
            }
          : {
              tasks: [{
                _id: 'task-board-1',
                title: 'Prepare demo',
                description: 'Prepare the product demo',
                status: 'todo',
                priority: 'high',
                labels: ['Release'],
                assignee: { _id: 'user-1', fullName: 'Alice Dupont' }
              }, {
                _id: 'task-board-2',
                title: 'Review release',
                description: 'Check the release notes',
                status: 'in_review',
                priority: 'medium',
                assignee: { _id: 'user-2', fullName: 'Bob Martin' }
              }, {
                _id: 'task-board-3',
                title: 'Write follow-up',
                description: '',
                status: 'todo',
                priority: 'low',
                assignee: null
              }]
            }
      }
    } as never));
    vi.mocked(api.patch).mockResolvedValue({ data: { data: { task: {} } } } as never);
    renderProjectDetailPage();

    expect(await screen.findByText('Tasks by member')).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'Alice Dupont tasks' })).toHaveTextContent('Prepare demo');
    expect(screen.getByRole('article', { name: 'Bob Martin tasks' })).toHaveTextContent('Review release');
    expect(screen.getByRole('article', { name: 'Unassigned tasks' })).toHaveTextContent('Write follow-up');
    expect(screen.getByText('Release')).toBeInTheDocument();

    const aliceStatus = screen.getByRole('combobox', { name: 'Status of Prepare demo' });
    const bobStatus = screen.getByRole('combobox', { name: 'Status of Review release' });
    const unassignedStatus = screen.getByRole('combobox', { name: 'Status of Write follow-up' });
    expect(aliceStatus).toBeEnabled();
    expect(bobStatus).toBeDisabled();
    expect(unassignedStatus).toBeDisabled();

    fireEvent.change(aliceStatus, { target: { value: 'in_progress' } });
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/projects/project-1/tasks/task-board-1/status', { status: 'in_progress' }));
  });

  it('creates an email-bound invite and shows a link that can be copied', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data: {
        data: url === '/projects/project-1'
          ? { project: { ...projects[0], members: [{ user: { _id: 'user-1', fullName: 'Alice Dupont' }, role: 'owner' }] }, metrics: {} }
          : { tasks: [] }
      }
    } as never));
    vi.mocked(api.post).mockResolvedValue({ data: { data: { inviteUrl: 'http://localhost:5173/invite/secure-token' } } } as never);
    renderProjectDetailPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Invite a member' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Member email' }), { target: { value: 'new.member@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invitation' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/projects/project-1/invitations', { email: 'new.member@example.com' }));
    expect(await screen.findByDisplayValue('http://localhost:5173/invite/secure-token')).toBeInTheDocument();
  });

  it('opens a copyable invitation-link dialog after creating a shareable link', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data: {
        data: url === '/projects/project-1'
          ? { project: { ...projects[0], members: [{ user: { _id: 'user-1', fullName: 'Alice Dupont' }, role: 'owner' }] }, metrics: {} }
          : { tasks: [] }
      }
    } as never));
    vi.mocked(api.post).mockResolvedValue({
      data: { data: { inviteUrl: 'http://localhost:5173/invite/shareable-token' } }
    } as never);
    renderProjectDetailPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Create a shareable link' }));

    expect(await screen.findByRole('dialog', { name: 'Invitation link is ready' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://localhost:5173/invite/shareable-token')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy invitation link' })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/projects/project-1/invitation-link');
  });

  it('routes settings to the existing profile page and does not advertise unavailable messaging', () => {
    renderPage(<AppLayout><p>Workspace</p></AppLayout>);

    expect(screen.getByRole('link', { name: 'Profile & settings' })).toHaveAttribute('href', '/profile');
    expect(screen.queryByRole('button', { name: 'Messages' })).not.toBeInTheDocument();
  });

  it('returns to the public home page after logout', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: null } } as never);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    queryClient.setQueryData(['me'], { _id: 'user-1', fullName: 'Alice Dupont', email: 'alice@example.com' });
    const replaceLocation = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/" element={<p>Public home</p>} />
            <Route path="/dashboard" element={<AppLayout><p>Private dashboard</p></AppLayout>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    vi.stubGlobal('location', { replace: replaceLocation });
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(replaceLocation).toHaveBeenCalledWith('/'));
    expect(api.post).toHaveBeenCalledWith('/auth/logout');
    expect(api.get).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['me'])).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('filters notifications and marks one or all notifications as read', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: {
          unreadCount: 1,
          notifications: [
            { _id: 'notification-new', title: 'New task assigned', message: 'A task has been assigned to you.', isRead: false, createdAt: '2026-10-19T10:00:00.000Z' },
            { _id: 'notification-old', title: 'Project updated', message: 'The project was updated.', isRead: true, createdAt: '2026-10-18T10:00:00.000Z' }
          ]
        }
      }
    } as never);
    vi.mocked(api.patch).mockResolvedValue({ data: { data: null } } as never);
    renderPage(<NotificationsPage />);

    expect(await screen.findByText('New task assigned')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter notifications' }), { target: { value: 'unread' } });
    expect(screen.getByText('New task assigned')).toBeInTheDocument();
    expect(screen.queryByText('Project updated')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/notifications/notification-new/read'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/notifications/read-all'));
  });

  it('shows the local default profile photo and saves profile details', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { user: { _id: 'user-1', fullName: 'Alice Dupont', email: 'alice@example.com', jobTitle: '', bio: '', avatarUrl: '' } } }
    } as never);
    vi.mocked(api.patch).mockResolvedValue({
      data: { data: { user: { _id: 'user-1', fullName: 'Alice Dupont', email: 'alice@example.com', jobTitle: 'QA', bio: 'Teamwork', avatarUrl: '' } } }
    } as never);
    renderPage(<ProfilePage />);

    const avatar = await screen.findByRole('img', { name: 'Profile photo of Alice Dupont' });
    expect(avatar).toHaveAttribute('src', '/default-avatar.svg');
    fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'QA' } });
    fireEvent.change(screen.getByLabelText('About'), { target: { value: 'Teamwork' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/auth/me', {
      fullName: 'Alice Dupont',
      jobTitle: 'QA',
      bio: 'Teamwork',
      avatarUrl: ''
    }));
  });

  it('previews a project invitation with the token in the request body', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        data: {
          project: { _id: 'project-1', name: 'Website refresh' },
          invitedEmail: null,
          alreadyMember: false,
          expiresAt: '2030-01-01T00:00:00.000Z'
        }
      }
    } as never);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/invite/secure-token']}>
          <Routes>
            <Route path="/invite/:token" element={<InviteLinkPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Join Website refresh')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/invitations/link-preview', { token: 'secure-token' });
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

vi.mock('../api', () => ({
  api: {
    post: vi.fn()
  }
}));

const user = {
  _id: 'user-1',
  fullName: 'Alice Dupont',
  email: 'alice@example.com'
};

function renderAuthPage(page: 'login' | 'register') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  const Page = page === 'login' ? LoginPage : RegisterPage;

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/${page}`]}>
          <Routes>
            <Route path={`/${page}`} element={<Page />} />
            <Route path="/dashboard" element={<p>Dashboard loaded</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  };
}

describe('Auth pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({
      data: { data: { user } }
    } as never);
  });

  it('updates cached user and navigates after login', async () => {
    const { queryClient } = renderAuthPage('login');

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TaskFlow home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Dashboard loaded')).toBeInTheDocument();
    await waitFor(() => expect(queryClient.getQueryData(['me'])).toEqual(user));
  });

  it('updates cached user and navigates after registration', async () => {
    const { queryClient } = renderAuthPage('register');

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TaskFlow home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: 'Main navigation' }).querySelector('a[href="/login"]')).not.toBeNull();
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: user.fullName } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));

    expect(await screen.findByText('Dashboard loaded')).toBeInTheDocument();
    await waitFor(() => expect(queryClient.getQueryData(['me'])).toEqual(user));
  });
});

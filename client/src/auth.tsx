import { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { api } from './api';
import type { User } from './types';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  refetchUser: () => Promise<unknown>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const requiresAuthentication = /^\/(dashboard|projects|tasks|notifications|invitations|profile|invite)(\/|$)/.test(pathname);
  const userQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/auth/me');
        return data.data.user as User;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 1000 * 60,
    enabled: requiresAuthentication
  });

  const value = useMemo<AuthContextType>(
    () => ({
      user: userQuery.data ?? null,
      loading: userQuery.isLoading,
      refetchUser: userQuery.refetch
    }),
    [userQuery.data, userQuery.isLoading, userQuery.refetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

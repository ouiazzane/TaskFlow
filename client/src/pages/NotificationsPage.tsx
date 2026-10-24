import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../api';
import type { NotificationItem } from '../types';

type NotificationFilter = 'all' | 'unread' | 'read';

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications');
      return data.data;
    }
  });
  const markOneRead = useMutation({
    mutationFn: async (notificationId: string) => {
      await api.patch(`/notifications/${notificationId}/read`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notification marked as read.');
    },
    onError: (mutationError: Error) => toast.error(mutationError.message)
  });
  const markAllRead = useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read.');
    },
    onError: (mutationError: Error) => toast.error(mutationError.message)
  });

  if (isLoading) return <div className="card">Loading notifications…</div>;
  if (isError) return <div className="card text-red-600">Error: {error instanceof Error ? error.message : 'Unable to load notifications.'}</div>;

  const notifications: NotificationItem[] = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? notifications.filter((notification) => !notification.isRead).length;
  const filteredNotifications = notifications.filter((notification) => (
    filter === 'all' || (filter === 'unread' ? !notification.isRead : notification.isRead)
  ));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Activity center</p>
          <h2 className="text-3xl font-bold text-slate-900">Notifications</h2>
          <p className="mt-1 text-sm text-slate-500">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button
            className="btn-secondary"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
            type="button"
          >
            <CheckCheck className="mr-2" size={16} />
            {markAllRead.isPending ? 'Updating…' : 'Mark all as read'}
          </button>
        )}
      </div>

      <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-sm font-medium text-slate-600" htmlFor="notification-filter">Show</label>
        <select
          aria-label="Filter notifications"
          className="input sm:w-auto"
          id="notification-filter"
          onChange={(event) => setFilter(event.target.value as NotificationFilter)}
          value={filter}
        >
          <option value="all">All notifications</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      <div className="space-y-3">
        {filteredNotifications.map((notification) => (
          <article key={notification._id} className={`card ${notification.isRead ? 'opacity-80' : 'border-indigo-200 bg-indigo-50/40'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{notification.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
                  <p className="mt-2 text-xs text-slate-400">{new Date(notification.createdAt).toLocaleString('en-US')}</p>
                </div>
              </div>
              {!notification.isRead && (
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="badge bg-indigo-100 text-indigo-700">Unread</span>
                  <button
                    className="text-xs font-medium text-indigo-700 hover:underline"
                    disabled={markOneRead.isPending && markOneRead.variables === notification._id}
                    onClick={() => markOneRead.mutate(notification._id)}
                    type="button"
                  >
                    Mark as read
                  </button>
                </div>
              )}
              {notification.isRead && <span className="badge bg-slate-100 text-slate-600">Read</span>}
            </div>
          </article>
        ))}
        {!filteredNotifications.length && (
          <div className="card flex items-center gap-3 text-slate-500">
            <Bell className="text-slate-400" />
            {filter === 'all' ? 'No notifications yet.' : filter === 'unread' ? 'No unread notifications.' : 'No read notifications.'}
          </div>
        )}
      </div>
    </div>
  );
}

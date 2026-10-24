export type User = {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  jobTitle?: string;
  bio?: string;
  preferences?: {
    theme?: 'light' | 'dark' | 'system';
    notifications?: boolean;
  };
};

export type Project = {
  _id: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  color?: string;
  owner?: User;
  members?: Array<{ user: User | string; role: string; joinedAt?: string }>;
  dueDate?: string;
  startDate?: string;
  createdAt?: string;
};

export type Task = {
  _id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: User | null;
  creator?: User;
  project?: Project | { _id: string; name: string };
  dueDate?: string;
  labels?: string[];
  createdAt?: string;
};

export type Comment = {
  _id: string;
  content: string;
  author?: User;
  createdAt?: string;
};

export type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedTask?: { _id: string; title: string };
  relatedProject?: { _id: string; name: string };
};

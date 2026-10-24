import mongoose, { Schema, type Document } from 'mongoose';

export interface IUser extends Document {
  fullName: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  jobTitle?: string;
  bio?: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required.'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters.']
    },
    email: {
      type: String,
      required: [true, 'Email address is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address.']
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 60
    },
    avatarUrl: {
      type: String,
      default: ''
    },
    jobTitle: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      default: ''
    },
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      notifications: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', userSchema);

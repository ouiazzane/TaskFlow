import mongoose, { Schema, type Document } from 'mongoose';

export interface IProjectMember {
  user: mongoose.Types.ObjectId;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
}

export interface IProject extends Document {
  name: string;
  description: string;
  owner: mongoose.Types.ObjectId;
  members: IProjectMember[];
  status: 'active' | 'completed' | 'archived';
  startDate?: Date;
  dueDate?: Date;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: [true, 'Project name is required.'],
      trim: true,
      minlength: [3, 'Project name must be at least 3 characters long.'],
      maxlength: [120, 'Project name cannot exceed 120 characters.']
    },
    description: {
      type: String,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters.']
    },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
        joinedAt: { type: Date, default: Date.now }
      }
    ],
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },
    startDate: Date,
    dueDate: Date,
    color: { type: String, default: '#4f46e5' }
  },
  { timestamps: true }
);

projectSchema.index({ owner: 1, status: 1 });
projectSchema.index({ 'members.user': 1, status: 1 });

export default mongoose.model<IProject>('Project', projectSchema);

import mongoose, { Schema, type Document } from 'mongoose';

export interface ITask extends Document {
  project: mongoose.Types.ObjectId;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  creator: mongoose.Types.ObjectId;
  assignee?: mongoose.Types.ObjectId | null;
  startDate?: Date;
  dueDate?: Date;
  labels: string[];
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    title: {
      type: String,
      required: [true, 'Task title is required.'],
      trim: true,
      minlength: [3, 'Task title must be at least 3 characters long.'],
      maxlength: [180, 'Task title cannot exceed 180 characters.']
    },
    description: { type: String, default: '', maxlength: [4000, 'Description cannot exceed 4000 characters.'] },
    status: { type: String, enum: ['todo', 'in_progress', 'in_review', 'done'], default: 'todo' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    startDate: Date,
    dueDate: Date,
    labels: [{ type: String, trim: true, maxlength: 40 }],
    position: { type: Number, default: 0 }
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, status: 1, dueDate: 1 });

taskSchema.index({ assignee: 1, status: 1 });

export default mongoose.model<ITask>('Task', taskSchema);

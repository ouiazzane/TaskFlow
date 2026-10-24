import mongoose, { Schema, type Document } from 'mongoose';

export interface IActivityLog extends Document {
  project: mongoose.Types.ObjectId;
  task?: mongoose.Types.ObjectId;
  actor: mongoose.Types.ObjectId;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const activitySchema = new Schema<IActivityLog>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    task: { type: Schema.Types.ObjectId, ref: 'Task' },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ project: 1, createdAt: -1 });

export default mongoose.model<IActivityLog>('ActivityLog', activitySchema);

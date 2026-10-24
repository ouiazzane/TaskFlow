import mongoose, { Schema, type Document } from 'mongoose';

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  actor?: mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  relatedProject?: mongoose.Types.ObjectId;
  relatedTask?: mongoose.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedProject: { type: Schema.Types.ObjectId, ref: 'Project' },
    relatedTask: { type: Schema.Types.ObjectId, ref: 'Task' },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export default mongoose.model<INotification>('Notification', notificationSchema);

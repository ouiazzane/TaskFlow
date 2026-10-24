import mongoose, { Schema, type Document } from 'mongoose';

export interface IComment extends Document {
  task: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    task: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: {
      type: String,
      required: [true, 'Comment is required.'],
      trim: true,
      minlength: [1, 'Comment cannot be empty.'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters.']
    }
  },
  { timestamps: true }
);

commentSchema.index({ task: 1, createdAt: -1 });

export default mongoose.model<IComment>('Comment', commentSchema);

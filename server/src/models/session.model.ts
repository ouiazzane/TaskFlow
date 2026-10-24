import mongoose, { Schema, type Document } from 'mongoose';

export interface IAuthSession extends Document {
  user: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const sessionSchema = new Schema<IAuthSession>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

sessionSchema.index({ user: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IAuthSession>('AuthSession', sessionSchema);

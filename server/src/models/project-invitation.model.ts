import mongoose, { Schema, type Document } from 'mongoose';

export interface IProjectInvitation extends Document {
  project: mongoose.Types.ObjectId;
  invitedEmail?: string;
  tokenHash: string;
  createdBy: mongoose.Types.ObjectId;
  expiresAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

const projectInvitationSchema = new Schema<IProjectInvitation>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    invitedEmail: { type: String, lowercase: true, trim: true },
    tokenHash: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: Date,
    revokedAt: Date
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

projectInvitationSchema.index({ project: 1, invitedEmail: 1 });
projectInvitationSchema.index({ invitedEmail: 1, acceptedAt: 1, expiresAt: 1 });
projectInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IProjectInvitation>('ProjectInvitation', projectInvitationSchema);

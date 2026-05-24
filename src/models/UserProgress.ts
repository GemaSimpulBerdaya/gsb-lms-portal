import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IQuizScore {
  moduleId: Types.ObjectId;
  score: number;
  passed: boolean;
  attemptedAt: Date;
}

export interface IUserProgress extends Document {
  externalUserId: string;
  completedModules: Types.ObjectId[];
  quizScores: IQuizScore[];
  createdAt: Date;
  updatedAt: Date;
}

const UserProgressSchema: Schema<IUserProgress> = new Schema(
  {
    externalUserId: { type: String, index: true, required: true },
    completedModules: [{ type: Schema.Types.ObjectId, ref: "Module" }],
    quizScores: [
      {
        moduleId: { type: Schema.Types.ObjectId, ref: "Module" },
        score: Number,
        passed: Boolean,
        attemptedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, collection: "student_progress" }
);

export const UserProgress: Model<IUserProgress> =
  (mongoose.models.UserProgress as Model<IUserProgress>) ||
  mongoose.model<IUserProgress>("UserProgress", UserProgressSchema);

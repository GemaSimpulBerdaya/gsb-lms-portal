import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IQuizQuestion {
  question: string;
  options: string[];
  /** Index ke array `options` untuk jawaban benar */
  correctAnswer: number;
}

export interface IQuiz extends Document {
  moduleId: Types.ObjectId;
  questions: IQuizQuestion[];
  passingScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const QuizSchema: Schema<IQuiz> = new Schema(
  {
    moduleId: { type: Schema.Types.ObjectId, ref: "Module", required: true },
    questions: [
      {
        question: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctAnswer: { type: Number, required: true },
      },
    ],
    passingScore: { type: Number, default: 75 },
  },
  { timestamps: true, collection: "quiz" }
);

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
  { timestamps: true, collection: "progres_siswa" }
);

export const Quiz: Model<IQuiz> =
  (mongoose.models.Quiz as Model<IQuiz>) ||
  mongoose.model<IQuiz>("Quiz", QuizSchema);

export const UserProgress: Model<IUserProgress> =
  (mongoose.models.UserProgress as Model<IUserProgress>) ||
  mongoose.model<IUserProgress>("UserProgress", UserProgressSchema);

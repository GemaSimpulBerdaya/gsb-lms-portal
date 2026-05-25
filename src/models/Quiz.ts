import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IQuizQuestion {
  question: string;
  options: string[];
  /** Index ke array `options` untuk jawaban benar */
  correctAnswer: number;
  /** Penjelasan opsional, ditampilkan setelah siswa menjawab */
  explanation?: string;
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
        explanation: { type: String, default: "" },
      },
    ],
    passingScore: { type: Number, default: 75 },
  },
  { timestamps: true, collection: "quizzes" }
);

export const Quiz: Model<IQuiz> =
  (mongoose.models.Quiz as Model<IQuiz>) ||
  mongoose.model<IQuiz>("Quiz", QuizSchema);

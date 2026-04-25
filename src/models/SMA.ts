import mongoose from "mongoose";

const QuizSchema = new mongoose.Schema({
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
  questions: [{
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: Number, required: true } // Index of options
  }],
  passingScore: { type: Number, default: 75 }
}, { timestamps: true, collection: 'quiz' });

const UserProgressSchema = new mongoose.Schema({
  externalUserId: { type: String, index: true, required: true }, // ID from Legacy JWT
  completedModules: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }],
  quizScores: [{
    moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
    score: Number,
    passed: Boolean,
    attemptedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true, collection: 'progres_siswa' });

export const Quiz = mongoose.models.Quiz || mongoose.model("Quiz", QuizSchema);
export const UserProgress = mongoose.models.UserProgress || mongoose.model("UserProgress", UserProgressSchema);

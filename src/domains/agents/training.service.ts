// Story 3-18: Agent Training Service
// Training modules, quizzes, and certification tracking for field agents.

import { PrismaClient } from '@prisma/client';
import { BusinessError } from '../../shared/errors/business-error.js';

export interface TrainingModuleContent {
  moduleId: string;
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  sections: TrainingSection[];
  quiz: QuizQuestion[];
  passingScorePercent: number;
  estimatedMinutes: number;
}

export interface TrainingSection {
  index: number;
  title: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'video' | 'image' | 'pdf';
}

export interface QuizQuestion {
  index: number;
  question: string;
  questionHi: string;
  options: string[];
  optionsHi: string[];
  correctIndex: number;
}

export interface QuizSubmission {
  moduleId: string;
  agentId: string;
  answers: number[]; // index of selected option per question
}

export class TrainingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all available training modules for an agent.
   */
  async getModules(agentId: string) {
    const modules = await this.prisma.trainingModule.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Get agent's completion status via TrainingProgress
    const completions = await this.prisma.trainingProgress.findMany({
      where: { agentId },
    });

    const completionMap = new Map(
      completions.map((c) => [c.trainingModuleId, c]),
    );

    return modules.map((mod) => {
      const completion = completionMap.get(mod.id);
      return {
        moduleId: mod.id,
        title: mod.title ?? mod.moduleName,
        titleHi: mod.titleHi ?? mod.moduleName,
        category: mod.category ?? mod.contentType,
        estimatedMinutes: mod.estimatedMinutes ?? 0,
        isMandatory: mod.isMandatory,
        status: completion
          ? completion.passed
            ? 'passed'
            : 'attempted'
          : 'not_started',
        score: completion?.scorePercent || null,
        completedAt: completion?.completedAt || null,
        attempts: completion?.attempts || 0,
      };
    });
  }

  /**
   * Get full training module content.
   */
  async getModuleContent(moduleId: string): Promise<TrainingModuleContent> {
    const mod = await this.prisma.trainingModule.findUnique({
      where: { id: moduleId },
    });

    if (!mod) {
      throw new BusinessError(
        'BUSINESS_MODULE_NOT_FOUND',
        'Training module not found',
        404,
      );
    }

    const content = (mod.content ?? mod.quizData ?? {}) as Record<string, any>;
    return {
      moduleId: mod.id,
      title: mod.title ?? mod.moduleName,
      titleHi: mod.titleHi ?? mod.moduleName,
      description: mod.description ?? '',
      descriptionHi: (content as any).descriptionHi ?? mod.description ?? '',
      sections: content.sections || [],
      quiz: content.quiz || [],
      passingScorePercent: mod.passingScorePercent,
      estimatedMinutes: mod.estimatedMinutes ?? 0,
    };
  }

  /**
   * Submit quiz answers and calculate score.
   */
  async submitQuiz(submission: QuizSubmission) {
    const mod = await this.prisma.trainingModule.findUnique({
      where: { id: submission.moduleId },
    });

    if (!mod) {
      throw new BusinessError(
        'BUSINESS_MODULE_NOT_FOUND',
        'Training module not found',
        404,
      );
    }

    const content = (mod.content ?? mod.quizData ?? {}) as Record<string, any>;
    const quiz: QuizQuestion[] = content.quiz || [];

    if (submission.answers.length !== quiz.length) {
      throw new BusinessError(
        'VALIDATION_ANSWER_COUNT_MISMATCH',
        `Expected ${quiz.length} answers, got ${submission.answers.length}`,
        400,
      );
    }

    // Grade quiz
    let correct = 0;
    const graded = quiz.map((q, i) => {
      const isCorrect = submission.answers[i] === q.correctIndex;
      if (isCorrect) correct++;
      return {
        questionIndex: i,
        selectedIndex: submission.answers[i],
        correctIndex: q.correctIndex,
        isCorrect,
      };
    });

    const scorePercent = Math.round((correct / quiz.length) * 100);
    const passingScore = mod.passingScorePercent;
    const passed = scorePercent >= passingScore;

    // Upsert completion record via TrainingProgress
    const existing = await this.prisma.trainingProgress.findUnique({
      where: {
        agentId_trainingModuleId: {
          agentId: submission.agentId,
          trainingModuleId: submission.moduleId,
        },
      },
    });

    let completion;
    if (existing) {
      completion = await this.prisma.trainingProgress.update({
        where: { id: existing.id },
        data: {
          scorePercent: Math.max(existing.scorePercent ?? 0, scorePercent),
          passed: existing.passed || passed,
          attempts: existing.attempts + 1,
          lastAttemptAt: new Date(),
          status: passed ? 'completed' : 'in_progress',
          ...(passed && !existing.passed ? { completedAt: new Date() } : {}),
        },
      });
    } else {
      completion = await this.prisma.trainingProgress.create({
        data: {
          trainingModuleId: submission.moduleId,
          agentId: submission.agentId,
          scorePercent,
          passed,
          attempts: 1,
          lastAttemptAt: new Date(),
          status: passed ? 'completed' : 'in_progress',
          ...(passed ? { completedAt: new Date() } : {}),
        },
      });
    }

    return {
      scorePercent,
      passed,
      passingScore,
      correctCount: correct,
      totalQuestions: quiz.length,
      gradedAnswers: graded,
      bestScore: completion.scorePercent,
      totalAttempts: completion.attempts,
    };
  }

  /**
   * Get agent's training progress summary.
   */
  async getProgressSummary(agentId: string) {
    const totalModules = await this.prisma.trainingModule.count({
      where: { isActive: true },
    });

    const mandatoryModules = await this.prisma.trainingModule.count({
      where: { isActive: true, isMandatory: true },
    });

    const completions = await this.prisma.trainingProgress.findMany({
      where: { agentId, passed: true },
    });

    // Get mandatory module IDs, then count how many the agent passed
    const mandatoryModuleIds = await this.prisma.trainingModule.findMany({
      where: { isActive: true, isMandatory: true },
      select: { id: true },
    });

    const mandatoryCompleted = await this.prisma.trainingProgress.count({
      where: {
        agentId,
        passed: true,
        trainingModuleId: { in: mandatoryModuleIds.map((m) => m.id) },
      },
    });

    return {
      totalModules,
      completedModules: completions.length,
      mandatoryModules,
      mandatoryCompleted,
      isCertified: mandatoryCompleted >= mandatoryModules,
      averageScore:
        completions.length > 0
          ? Math.round(
              completions.reduce((sum, c) => sum + (c.scorePercent ?? 0), 0) /
                completions.length,
            )
          : 0,
    };
  }
}

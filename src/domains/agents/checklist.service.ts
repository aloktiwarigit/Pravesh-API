// Stories 3-5, 3-10a/b/c, 3-19: Checklist Service
// Guided checklists for agent field operations. Each service type has
// a checklist template; agents mark steps, upload photos, capture GPS.

import { PrismaClient } from '@prisma/client';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import PgBoss from 'pg-boss';
import { BusinessError } from '../../shared/errors/business-error.js';

/**
 * Shape of the `definition` JSONB field on ServiceDefinition.
 * Only the fields consumed by the checklist service are declared here.
 */
interface ServiceDefinitionJson {
  steps?: Array<{
    name: string;
    nameHi?: string;
    description?: string;
    descriptionHi?: string;
    agentActions?: string[];
    requiredDocuments?: Array<{ code: string }>;
  }>;
}

export interface ChecklistTemplate {
  serviceCode: string;
  steps: ChecklistStepTemplate[];
}

export interface ChecklistStepTemplate {
  index: number;
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  requiresPhoto: boolean;
  requiresGps: boolean;
  requiresDocument: boolean;
  documentType?: string;
  isMandatory: boolean;
}

export interface ChecklistStepCompletion {
  checklistId: string;
  stepIndex: number;
  agentId: string;
  gpsLat?: number;
  gpsLng?: number;
  photoUrls?: string[];
  documentId?: string;
  notes?: string;
  idempotencyKey?: string;
}

export class ChecklistService {
  constructor(
    private prisma: PrismaClient,
    private boss: any, // PgBoss instance
  ) {}

  /**
   * Get the checklist template for a service code.
   */
  async getTemplate(serviceCode: string): Promise<ChecklistTemplate | null> {
    const definition = await this.prisma.serviceDefinition.findFirst({
      where: { code: serviceCode, isActive: true },
    });

    if (!definition) return null;

    const def = definition.definition as ServiceDefinitionJson;
    const steps: ChecklistStepTemplate[] = (def.steps || []).map(
      (step, index: number) => ({
        index,
        title: step.name,
        titleHi: step.nameHi || step.name,
        description: step.description ?? '',
        descriptionHi: step.descriptionHi || step.description || '',
        requiresPhoto: (step.agentActions || []).includes('photo_evidence'),
        requiresGps: (step.agentActions || []).includes('gps_evidence'),
        requiresDocument: (step.requiredDocuments || []).length > 0,
        documentType: step.requiredDocuments?.[0]?.code,
        isMandatory: true,
      }),
    );

    return { serviceCode, steps };
  }

  /**
   * Initialize a checklist for a task (creates progress records).
   */
  async initializeChecklist(taskId: string, serviceCode: string) {
    const template = await this.getTemplate(serviceCode);
    if (!template) {
      throw new BusinessError(
        'BUSINESS_NO_CHECKLIST_TEMPLATE',
        `No checklist template found for service: ${serviceCode}`,
        422,
      );
    }

    // Check if already initialized
    const existing = await this.prisma.checklist.findUnique({
      where: { taskId },
    });

    if (existing) {
      return this.getChecklistProgress(taskId);
    }

    // Create checklist record
    const checklist = await this.prisma.checklist.create({
      data: {
        taskId,
        serviceCode,
        totalSteps: template.steps.length,
        completedSteps: 0,
        templateSnapshot: template as unknown as InputJsonValue,
      },
    });

    // Create step progress records
    const stepData = template.steps.map((step) => ({
      checklistId: checklist.id,
      taskId,
      stepIndex: step.index,
      title: step.title,
      titleHi: step.titleHi,
      requiresPhoto: step.requiresPhoto,
      requiresGps: step.requiresGps,
      requiresDocument: step.requiresDocument,
      isMandatory: step.isMandatory,
      isCompleted: false,
    }));

    await this.prisma.checklistProgress.createMany({ data: stepData });

    return this.getChecklistProgress(taskId);
  }

  /**
   * Get current checklist progress for a task.
   */
  async getChecklistProgress(taskId: string) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { taskId },
    });

    if (!checklist) return null;

    const steps = await this.prisma.checklistProgress.findMany({
      where: { checklistId: checklist.id },
      orderBy: { stepIndex: 'asc' },
    });

    return {
      checklistId: checklist.id,
      taskId,
      serviceCode: checklist.serviceCode,
      totalSteps: checklist.totalSteps,
      completedSteps: steps.filter((s) => s.isCompleted).length,
      percentComplete: Math.round(
        (steps.filter((s) => s.isCompleted).length / checklist.totalSteps) *
          100,
      ),
      steps,
    };
  }

  /**
   * Complete a checklist step with evidence.
   */
  async completeStep(completion: ChecklistStepCompletion) {
    // Idempotency
    if (completion.idempotencyKey) {
      const existing = await this.prisma.syncLog.findUnique({
        where: { idempotencyKey: completion.idempotencyKey },
      });
      if (existing) {
        return { alreadyProcessed: true };
      }
    }

    const step = await this.prisma.checklistProgress.findFirst({
      where: {
        checklistId: completion.checklistId,
        stepIndex: completion.stepIndex,
      },
    });

    if (!step) {
      throw new BusinessError(
        'BUSINESS_CHECKLIST_STEP_NOT_FOUND',
        'Checklist step not found',
        404,
      );
    }

    // Validate required evidence
    if (step.requiresPhoto && (!completion.photoUrls || completion.photoUrls.length === 0)) {
      throw new BusinessError(
        'VALIDATION_PHOTO_REQUIRED',
        'This step requires photo evidence',
        400,
      );
    }

    if (step.requiresGps && (!completion.gpsLat || !completion.gpsLng)) {
      throw new BusinessError(
        'VALIDATION_GPS_REQUIRED',
        'This step requires GPS location',
        400,
      );
    }

    if (step.requiresDocument && !completion.documentId) {
      throw new BusinessError(
        'VALIDATION_DOCUMENT_REQUIRED',
        'This step requires document upload',
        400,
      );
    }

    // Update step
    const updatedStep = await this.prisma.checklistProgress.update({
      where: { id: step.id },
      data: {
        isCompleted: true,
        completedAt: new Date(),
        completedBy: completion.agentId,
        gpsLat: completion.gpsLat,
        gpsLng: completion.gpsLng,
        photoUrls: completion.photoUrls || [],
        documentId: completion.documentId,
        notes: completion.notes,
      },
    });

    // Update checklist completed count
    const completedCount = await this.prisma.checklistProgress.count({
      where: { checklistId: completion.checklistId, isCompleted: true },
    });

    const checklist = await this.prisma.checklist.update({
      where: { id: completion.checklistId },
      data: {
        completedSteps: completedCount,
        ...(completedCount === (await this.prisma.checklist.findUnique({ where: { id: completion.checklistId } }))?.totalSteps
          ? { completedAt: new Date() }
          : {}),
      },
    });

    // Record sync log for idempotency
    if (completion.idempotencyKey) {
      await this.prisma.syncLog.create({
        data: {
          idempotencyKey: completion.idempotencyKey,
          entityType: 'checklist_step',
          agentId: completion.agentId,
          processedAt: new Date(),
          clientTimestamp: new Date(),
        },
      });
    }

    // Notify if checklist fully completed
    if (completedCount === checklist.totalSteps) {
      await this.boss.send('notification.send', {
        type: 'checklist_completed',
        taskId: step.taskId,
        checklistId: completion.checklistId,
      });
    }

    return {
      alreadyProcessed: false,
      step: updatedStep,
      checklistProgress: {
        completedSteps: completedCount,
        totalSteps: checklist.totalSteps,
        isComplete: completedCount === checklist.totalSteps,
      },
    };
  }

  /**
   * Undo a checklist step (Ops or agent correction).
   */
  async undoStep(checklistId: string, stepIndex: number, undoneBy: string) {
    const step = await this.prisma.checklistProgress.findFirst({
      where: { checklistId, stepIndex },
    });

    if (!step || !step.isCompleted) {
      throw new BusinessError(
        'BUSINESS_STEP_NOT_COMPLETED',
        'Step is not completed, cannot undo',
        422,
      );
    }

    await this.prisma.checklistProgress.update({
      where: { id: step.id },
      data: {
        isCompleted: false,
        completedAt: null,
        completedBy: null,
        notes: `Undone by ${undoneBy} at ${new Date().toISOString()}`,
      },
    });

    const completedCount = await this.prisma.checklistProgress.count({
      where: { checklistId, isCompleted: true },
    });

    await this.prisma.checklist.update({
      where: { id: checklistId },
      data: { completedSteps: completedCount, completedAt: null },
    });

    return { completedSteps: completedCount };
  }
}

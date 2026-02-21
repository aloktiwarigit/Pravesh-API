// Story 6.3 + 6.4: pg-boss job for AI document verification
// Job name follows {domain}.{action} pattern per DA-4
import { PrismaClient } from '@prisma/client';
// AiVerificationService is loaded dynamically inside the handler to avoid
// crashing at import time when @azure/ai-form-recognizer is not installed.
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

export const DOCUMENT_VERIFY_JOB = 'document.ai-verify';

interface DocumentVerifyPayload {
  documentId: string;
  storagePath: string;
  expectedType: string;
  serviceInstanceId: string;
}

/**
 * Handles AI verification of uploaded documents.
 * 1. Downloads document from Firebase Storage
 * 2. Sends to Azure Cognitive Services for OCR
 * 3. Classifies document type, checks completeness, legibility
 * 4. Updates document record with verification results
 * 5. Pushes real-time status via Firestore
 * 6. Routes low-confidence results to ops review queue
 */
export async function handleDocumentVerify(job: { data: DocumentVerifyPayload }) {
  const { documentId, storagePath, expectedType, serviceInstanceId } = job.data;
  const startTime = Date.now();

  try {
    // Log job start (AC: JobExecutionLog)
    // JobExecutionLog requires: jobName, jobId, startTime, endTime, durationMs, result (string)
    const now = new Date();
    await prisma.jobExecutionLog.create({
      data: {
        jobName: DOCUMENT_VERIFY_JOB,
        jobId: documentId,
        documentId,
        startTime: now,
        endTime: now, // Will be updated on completion
        durationMs: 0,
        result: 'running',
        metadata: job.data as any,
      },
    });

    // Dynamic import: only loads @azure/ai-form-recognizer when a job actually runs
    const { AiVerificationService } = await import('../../../domains/documents/ai-verification.service.js');
    const aiService = new AiVerificationService();
    const result = await aiService.verifyDocument({ id: documentId, storagePath, docType: expectedType });

    // Update document with verification results (AC1, AC2)
    // Document model has: verificationStatus, aiVerificationResult
    await prisma.document.update({
      where: { id: documentId },
      data: {
        verificationStatus: result.overall_status,
        aiVerificationResult: result as any,
      },
    });

    // Push real-time status update via Firestore (AC3)
    const firestore = getFirestore();
    await firestore
      .collection('service_events')
      .doc(serviceInstanceId)
      .collection('document_statuses')
      .doc(documentId)
      .set({
        status: result.overall_status,
        confidence: result.confidence_score,
        classifiedType: result.doc_type_detected,
        updatedAt: new Date().toISOString(),
      });

    // Route low-confidence results to ops review queue (AC4, Story 6.6)
    // OpsReviewTask has: type, resourceId, resourceType, status, metadata, cityId
    if (result.overall_status === 'needs_review' || result.confidence_score < 70) {
      // Fetch document to get cityId
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { cityId: true },
      });
      await prisma.opsReviewTask.create({
        data: {
          type: 'document_review',
          resourceId: documentId,
          resourceType: 'document',
          status: 'pending',
          cityId: doc?.cityId || '',
          metadata: {
            serviceInstanceId,
            reason: result.confidence_score < 70
              ? `Low AI confidence: ${result.confidence_score.toFixed(1)}%`
              : 'Document needs manual review',
            aiResult: result,
          } as any,
        },
      });
    }

    // Log job completion
    const duration = Date.now() - startTime;
    await prisma.jobExecutionLog.updateMany({
      where: { jobId: documentId, jobName: DOCUMENT_VERIFY_JOB, result: 'running' },
      data: {
        result: 'completed',
        endTime: new Date(),
        durationMs: duration,
        metadata: result as any,
      },
    });

    logger.info(
      {
        documentId,
        status: result.overall_status,
        confidenceScore: result.confidence_score,
        durationMs: duration
      },
      '[document-verify] Document verified'
    );
  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    // Update document status to error
    await prisma.document.update({
      where: { id: documentId },
      data: { verificationStatus: 'error' },
    }).catch(() => {}); // Don't fail on status update

    // Log job failure
    await prisma.jobExecutionLog.updateMany({
      where: { jobId: documentId, jobName: DOCUMENT_VERIFY_JOB, result: 'running' },
      data: {
        result: 'failed',
        endTime: new Date(),
        durationMs: duration,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => {});

    logger.error({ documentId, error }, '[document-verify] Failed');
    throw error; // Let pg-boss handle retries
  }
}

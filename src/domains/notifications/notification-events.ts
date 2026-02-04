/**
 * Story 7-2: Notification Event Convenience Helpers
 * Pre-built functions for common notification events
 */

import { NotificationQueueService } from './notification-queue.service';

const queueService = new NotificationQueueService();

export async function notifyServiceStatusChange(params: {
  userId: string;
  serviceName: string;
  stepName: string;
  currentStep: number;
  totalSteps: number;
  agentName: string;
  serviceInstanceId: string;
  language: 'en' | 'hi';
}): Promise<void> {
  const suffix = `${params.language}_v1`;
  const contextData = {
    service_name: params.serviceName,
    step_name: params.stepName,
    current_step: String(params.currentStep),
    total_steps: String(params.totalSteps),
    agent_name: params.agentName,
    customer_name: '', // Resolved by handler from userId
  };

  // Queue push notification
  await queueService.queueNotification({
    userId: params.userId,
    templateCode: `service_status_change_push_${suffix}`,
    channel: 'push',
    priority: 'high',
    serviceInstanceId: params.serviceInstanceId,
    eventType: 'service_status_change',
    contextData,
  });

  // Queue WhatsApp message
  await queueService.queueNotification({
    userId: params.userId,
    templateCode: `service_status_change_wa_${suffix}`,
    channel: 'whatsapp',
    priority: 'high',
    serviceInstanceId: params.serviceInstanceId,
    eventType: 'service_status_change',
    contextData,
  });
}

export async function notifyPaymentConfirmation(params: {
  userId: string;
  serviceName: string;
  amount: string;
  receiptId: string;
  serviceInstanceId: string;
  language: 'en' | 'hi';
}): Promise<void> {
  const suffix = `${params.language}_v1`;
  const contextData = {
    service_name: params.serviceName,
    amount: params.amount,
    receipt_id: params.receiptId,
    customer_name: '',
  };

  await queueService.queueNotification({
    userId: params.userId,
    templateCode: `payment_confirmation_push_${suffix}`,
    channel: 'push',
    priority: 'high',
    serviceInstanceId: params.serviceInstanceId,
    eventType: 'payment_confirmation',
    contextData,
  });

  await queueService.queueNotification({
    userId: params.userId,
    templateCode: `payment_confirmation_sms_${suffix}`,
    channel: 'sms',
    priority: 'high',
    serviceInstanceId: params.serviceInstanceId,
    eventType: 'payment_confirmation',
    contextData,
  });
}

export async function notifyDocumentDelivered(params: {
  userId: string;
  customerName: string;
  serviceName: string;
  documentName: string;
  serviceInstanceId: string;
  language: 'en' | 'hi';
}): Promise<void> {
  const suffix = `${params.language}_v1`;

  await queueService.queueNotification({
    userId: params.userId,
    templateCode: `document_delivered_push_${suffix}`,
    channel: 'push',
    priority: 'normal',
    serviceInstanceId: params.serviceInstanceId,
    eventType: 'document_delivered',
    contextData: {
      service_name: params.serviceName,
      document_name: params.documentName,
    },
  });

  await queueService.queueNotification({
    userId: params.userId,
    templateCode: `document_delivered_wa_${suffix}`,
    channel: 'whatsapp',
    priority: 'normal',
    serviceInstanceId: params.serviceInstanceId,
    eventType: 'document_delivered',
    contextData: {
      customer_name: params.customerName,
      service_name: params.serviceName,
      document_name: params.documentName,
    },
  });
}

export async function notifyTaskAssignment(params: {
  agentUserId: string;
  serviceName: string;
  customerName: string;
  propertyAddress: string;
  serviceInstanceId: string;
  language: 'en' | 'hi';
}): Promise<void> {
  const suffix = `${params.language}_v1`;

  await queueService.queueNotification({
    userId: params.agentUserId,
    templateCode: `task_assignment_push_${suffix}`,
    channel: 'push',
    priority: 'high',
    serviceInstanceId: params.serviceInstanceId,
    eventType: 'task_assignment',
    contextData: {
      service_name: params.serviceName,
      customer_name: params.customerName,
      property_address: params.propertyAddress,
    },
  });
}

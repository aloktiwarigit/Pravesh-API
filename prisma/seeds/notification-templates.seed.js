"use strict";
/**
 * Story 7-1: Notification Templates Seed Data
 * Bilingual (Hindi + English) templates for all notification channels
 * Uses Mustache {{placeholder}} syntax
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedNotificationTemplates = seedNotificationTemplates;
const templates = [
    // === Service Status Change -- Push ===
    {
        templateCode: 'service_status_change_push_en_v1',
        eventType: 'service_status_change',
        channel: 'push',
        language: 'en',
        subject: '{{service_name}} -- Status Update',
        body: 'Your {{service_name}} has moved to step {{current_step}} of {{total_steps}}: {{step_name}}. Agent: {{agent_name}}.',
        version: 1,
    },
    {
        templateCode: 'service_status_change_push_hi_v1',
        eventType: 'service_status_change',
        channel: 'push',
        language: 'hi',
        subject: '{{service_name}} -- \u0938\u094D\u0925\u093F\u0924\u093F \u0905\u092A\u0921\u0947\u091F',
        body: '\u0906\u092A\u0915\u0940 {{service_name}} \u0938\u0947\u0935\u093E \u091A\u0930\u0923 {{current_step}}/{{total_steps}} \u092A\u0930 \u0939\u0948: {{step_name}}\u0964 \u090F\u091C\u0947\u0902\u091F: {{agent_name}}\u0964',
        version: 1,
    },
    // === Service Status Change -- WhatsApp ===
    {
        templateCode: 'service_status_change_wa_en_v1',
        eventType: 'service_status_change',
        channel: 'whatsapp',
        language: 'en',
        subject: null,
        body: 'Hello {{customer_name}}, your {{service_name}} is now at step {{current_step}} of {{total_steps}}: *{{step_name}}*. Your agent {{agent_name}} is handling this. Track progress in the app.',
        version: 1,
        whatsappTemplateName: 'service_status_update_en',
    },
    {
        templateCode: 'service_status_change_wa_hi_v1',
        eventType: 'service_status_change',
        channel: 'whatsapp',
        language: 'hi',
        subject: null,
        body: '\u0928\u092E\u0938\u094D\u0924\u0947 {{customer_name}}, \u0906\u092A\u0915\u0940 {{service_name}} \u0938\u0947\u0935\u093E \u0905\u092C \u091A\u0930\u0923 {{current_step}}/{{total_steps}} \u092A\u0930 \u0939\u0948: *{{step_name}}*\u0964 \u0906\u092A\u0915\u0947 \u090F\u091C\u0947\u0902\u091F {{agent_name}} \u0907\u0938\u0947 \u0938\u0902\u092D\u093E\u0932 \u0930\u0939\u0947 \u0939\u0948\u0902\u0964 \u090F\u092A \u092E\u0947\u0902 \u092A\u094D\u0930\u0917\u0924\u093F \u091F\u094D\u0930\u0948\u0915 \u0915\u0930\u0947\u0902\u0964',
        version: 1,
        whatsappTemplateName: 'service_status_update_hi',
    },
    // === Payment Confirmation -- Push ===
    {
        templateCode: 'payment_confirmation_push_en_v1',
        eventType: 'payment_confirmation',
        channel: 'push',
        language: 'en',
        subject: 'Payment Received -- {{service_name}}',
        body: 'We received \u20B9{{amount}} for {{service_name}}. Receipt ID: {{receipt_id}}.',
        version: 1,
    },
    {
        templateCode: 'payment_confirmation_push_hi_v1',
        eventType: 'payment_confirmation',
        channel: 'push',
        language: 'hi',
        subject: '\u092D\u0941\u0917\u0924\u093E\u0928 \u092A\u094D\u0930\u093E\u092A\u094D\u0924 -- {{service_name}}',
        body: '{{service_name}} \u0915\u0947 \u0932\u093F\u090F \u20B9{{amount}} \u092A\u094D\u0930\u093E\u092A\u094D\u0924 \u0939\u0941\u0906\u0964 \u0930\u0938\u0940\u0926: {{receipt_id}}\u0964',
        version: 1,
    },
    // === Payment Confirmation -- SMS ===
    {
        templateCode: 'payment_confirmation_sms_en_v1',
        eventType: 'payment_confirmation',
        channel: 'sms',
        language: 'en',
        subject: null,
        body: 'PROPLA: Rs{{amount}} received for {{service_name}}. Receipt: {{receipt_id}}. Track at app.propla.in',
        version: 1,
    },
    {
        templateCode: 'payment_confirmation_sms_hi_v1',
        eventType: 'payment_confirmation',
        channel: 'sms',
        language: 'hi',
        subject: null,
        body: 'PROPLA: {{service_name}} \u0915\u0947 \u0932\u093F\u090F \u20B9{{amount}} \u092A\u094D\u0930\u093E\u092A\u094D\u0924\u0964 \u0930\u0938\u0940\u0926: {{receipt_id}}\u0964 \u091F\u094D\u0930\u0948\u0915 \u0915\u0930\u0947\u0902: app.propla.in',
        version: 1,
    },
    // === Payment Confirmation -- WhatsApp ===
    {
        templateCode: 'payment_confirmation_wa_en_v1',
        eventType: 'payment_confirmation',
        channel: 'whatsapp',
        language: 'en',
        subject: null,
        body: 'Hello {{customer_name}}, your payment of *\u20B9{{amount}}* for {{service_name}} has been received. Receipt ID: {{receipt_id}}. Thank you!',
        version: 1,
        whatsappTemplateName: 'payment_receipt_en',
    },
    {
        templateCode: 'payment_confirmation_wa_hi_v1',
        eventType: 'payment_confirmation',
        channel: 'whatsapp',
        language: 'hi',
        subject: null,
        body: '\u0928\u092E\u0938\u094D\u0924\u0947 {{customer_name}}, \u0906\u092A\u0915\u0940 {{service_name}} \u0938\u0947\u0935\u093E \u0915\u0947 \u0932\u093F\u090F *\u20B9{{amount}}* \u0915\u093E \u092D\u0941\u0917\u0924\u093E\u0928 \u092A\u094D\u0930\u093E\u092A\u094D\u0924 \u0939\u0941\u0906\u0964 \u0930\u0938\u0940\u0926: {{receipt_id}}\u0964 \u0927\u0928\u094D\u092F\u0935\u093E\u0926!',
        version: 1,
        whatsappTemplateName: 'payment_receipt_hi',
    },
    // === Document Delivered -- Push ===
    {
        templateCode: 'document_delivered_push_en_v1',
        eventType: 'document_delivered',
        channel: 'push',
        language: 'en',
        subject: 'Document Ready -- {{document_name}}',
        body: 'Your {{document_name}} for {{service_name}} is now available in the app. Tap to view.',
        version: 1,
    },
    {
        templateCode: 'document_delivered_push_hi_v1',
        eventType: 'document_delivered',
        channel: 'push',
        language: 'hi',
        subject: '\u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u0924\u0948\u092F\u093E\u0930 -- {{document_name}}',
        body: '{{service_name}} \u0915\u0947 \u0932\u093F\u090F \u0906\u092A\u0915\u093E {{document_name}} \u090F\u092A \u092E\u0947\u0902 \u0909\u092A\u0932\u092C\u094D\u0927 \u0939\u0948\u0964 \u0926\u0947\u0916\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u091F\u0948\u092A \u0915\u0930\u0947\u0902\u0964',
        version: 1,
    },
    // === Document Delivered -- WhatsApp ===
    {
        templateCode: 'document_delivered_wa_en_v1',
        eventType: 'document_delivered',
        channel: 'whatsapp',
        language: 'en',
        subject: null,
        body: 'Hello {{customer_name}}, your *{{document_name}}* for {{service_name}} is ready. Download it from the app or reply VIEW to get a link.',
        version: 1,
        whatsappTemplateName: 'document_ready_en',
    },
    {
        templateCode: 'document_delivered_wa_hi_v1',
        eventType: 'document_delivered',
        channel: 'whatsapp',
        language: 'hi',
        subject: null,
        body: '\u0928\u092E\u0938\u094D\u0924\u0947 {{customer_name}}, {{service_name}} \u0915\u0947 \u0932\u093F\u090F \u0906\u092A\u0915\u093E *{{document_name}}* \u0924\u0948\u092F\u093E\u0930 \u0939\u0948\u0964 \u090F\u092A \u0938\u0947 \u0921\u093E\u0909\u0928\u0932\u094B\u0921 \u0915\u0930\u0947\u0902 \u092F\u093E VIEW \u091F\u093E\u0907\u092A \u0915\u0930\u0947\u0902\u0964',
        version: 1,
        whatsappTemplateName: 'document_ready_hi',
    },
    // === SLA Alert -- Push ===
    {
        templateCode: 'sla_alert_push_en_v1',
        eventType: 'sla_alert',
        channel: 'push',
        language: 'en',
        subject: 'SLA Alert -- {{service_name}}',
        body: 'Action needed: {{service_name}} step "{{step_name}}" is approaching its deadline ({{sla_deadline}}). Agent: {{agent_name}}.',
        version: 1,
    },
    {
        templateCode: 'sla_alert_push_hi_v1',
        eventType: 'sla_alert',
        channel: 'push',
        language: 'hi',
        subject: 'SLA \u0905\u0932\u0930\u094D\u091F -- {{service_name}}',
        body: '\u0915\u093E\u0930\u094D\u0930\u0935\u093E\u0908 \u0906\u0935\u0936\u094D\u092F\u0915: {{service_name}} \u0915\u093E "{{step_name}}" \u091A\u0930\u0923 \u0938\u092E\u092F \u0938\u0940\u092E\u093E ({{sla_deadline}}) \u092A\u0930 \u092A\u0939\u0941\u0901\u091A \u0930\u0939\u093E \u0939\u0948\u0964 \u090F\u091C\u0947\u0902\u091F: {{agent_name}}\u0964',
        version: 1,
    },
    // === Auto-Reassurance -- WhatsApp ===
    {
        templateCode: 'auto_reassurance_wa_en_v1',
        eventType: 'auto_reassurance',
        channel: 'whatsapp',
        language: 'en',
        subject: null,
        body: 'Hello {{customer_name}}, just an update -- your {{service_name}} is progressing well. Currently at *{{step_name}}* (step {{current_step}}/{{total_steps}}). Government processes sometimes take time, but your agent {{agent_name}} is on it. We will update you as soon as the next step is complete.',
        version: 1,
        whatsappTemplateName: 'auto_reassurance_en',
    },
    {
        templateCode: 'auto_reassurance_wa_hi_v1',
        eventType: 'auto_reassurance',
        channel: 'whatsapp',
        language: 'hi',
        subject: null,
        body: '\u0928\u092E\u0938\u094D\u0924\u0947 {{customer_name}}, \u0906\u092A\u0915\u0940 {{service_name}} \u0938\u0947\u0935\u093E \u0905\u091A\u094D\u091B\u0940 \u0924\u0930\u0939 \u0906\u0917\u0947 \u092C\u0922\u093C \u0930\u0939\u0940 \u0939\u0948\u0964 \u0905\u092D\u0940 *{{step_name}}* (\u091A\u0930\u0923 {{current_step}}/{{total_steps}}) \u092A\u0930 \u0939\u0948\u0964 \u0938\u0930\u0915\u093E\u0930\u0940 \u092A\u094D\u0930\u0915\u094D\u0930\u093F\u092F\u093E\u0913\u0902 \u092E\u0947\u0902 \u0938\u092E\u092F \u0932\u0917\u0924\u093E \u0939\u0948, \u0932\u0947\u0915\u093F\u0928 \u0906\u092A\u0915\u0947 \u090F\u091C\u0947\u0902\u091F {{agent_name}} \u0907\u0938 \u092A\u0930 \u0915\u093E\u092E \u0915\u0930 \u0930\u0939\u0947 \u0939\u0948\u0902\u0964 \u0905\u0917\u0932\u093E \u091A\u0930\u0923 \u092A\u0942\u0930\u093E \u0939\u094B\u0924\u0947 \u0939\u0940 \u0939\u092E \u0906\u092A\u0915\u094B \u092C\u0924\u093E\u090F\u0902\u0917\u0947\u0964',
        version: 1,
        whatsappTemplateName: 'auto_reassurance_hi',
    },
    // === Disruption Broadcast -- WhatsApp ===
    {
        templateCode: 'disruption_broadcast_wa_en_v1',
        eventType: 'disruption_broadcast',
        channel: 'whatsapp',
        language: 'en',
        subject: null,
        body: 'Important Notice: {{disruption_title}}. {{disruption_details}}. Affected services: {{affected_services}}. Expected resolution: {{resolution_date}}. We apologize for the inconvenience.',
        version: 1,
        whatsappTemplateName: 'disruption_broadcast_en',
    },
    {
        templateCode: 'disruption_broadcast_wa_hi_v1',
        eventType: 'disruption_broadcast',
        channel: 'whatsapp',
        language: 'hi',
        subject: null,
        body: '\u092E\u0939\u0924\u094D\u0935\u092A\u0942\u0930\u094D\u0923 \u0938\u0942\u091A\u0928\u093E: {{disruption_title}}\u0964 {{disruption_details}}\u0964 \u092A\u094D\u0930\u092D\u093E\u0935\u093F\u0924 \u0938\u0947\u0935\u093E\u090F\u0902: {{affected_services}}\u0964 \u0905\u0928\u0941\u092E\u093E\u0928\u093F\u0924 \u0938\u092E\u093E\u0927\u093E\u0928: {{resolution_date}}\u0964 \u0905\u0938\u0941\u0935\u093F\u0927\u093E \u0915\u0947 \u0932\u093F\u090F \u0916\u0947\u0926 \u0939\u0948\u0964',
        version: 1,
        whatsappTemplateName: 'disruption_broadcast_hi',
    },
    // === Task Assignment -- Push ===
    {
        templateCode: 'task_assignment_push_en_v1',
        eventType: 'task_assignment',
        channel: 'push',
        language: 'en',
        subject: 'New Task Assigned: {{service_name}}',
        body: '{{customer_name}} -- {{property_address}}. Contact within 4 hours.',
        version: 1,
    },
    {
        templateCode: 'task_assignment_push_hi_v1',
        eventType: 'task_assignment',
        channel: 'push',
        language: 'hi',
        subject: '\u0928\u092F\u093E \u0915\u093E\u0930\u094D\u092F \u0938\u094C\u0902\u092A\u093E \u0917\u092F\u093E: {{service_name}}',
        body: '{{customer_name}} -- {{property_address}}\u0964 4 \u0918\u0902\u091F\u0947 \u092E\u0947\u0902 \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0902\u0964',
        version: 1,
    },
    // === Payment Link -- WhatsApp ===
    {
        templateCode: 'payment_link_wa_en_v1',
        eventType: 'payment_link',
        channel: 'whatsapp',
        language: 'en',
        subject: null,
        body: 'Hello {{customer_name}}, complete your payment for *{{service_name}}*.\nAmount: \u20B9{{amount}}\nLink: {{link_url}}\nThis link expires in 48 hours.',
        version: 1,
        whatsappTemplateName: 'payment_link_en',
    },
    {
        templateCode: 'payment_link_wa_hi_v1',
        eventType: 'payment_link',
        channel: 'whatsapp',
        language: 'hi',
        subject: null,
        body: '\u0928\u092E\u0938\u094D\u0924\u0947 {{customer_name}}, \u0905\u092A\u0928\u0947 *{{service_name}}* \u0915\u0947 \u0932\u093F\u090F \u092D\u0941\u0917\u0924\u093E\u0928 \u0915\u0930\u0947\u0902\u0964\n\u0930\u093E\u0936\u093F: \u20B9{{amount}}\n\u0932\u093F\u0902\u0915: {{link_url}}\n\u092F\u0939 \u0932\u093F\u0902\u0915 48 \u0918\u0902\u091F\u0947 \u092E\u0947\u0902 \u0938\u092E\u093E\u092A\u094D\u0924 \u0939\u094B\u0917\u093E\u0964',
        version: 1,
        whatsappTemplateName: 'payment_link_hi',
    },
    // === Receipt Delivery -- SMS ===
    {
        templateCode: 'receipt_delivery_sms_en_v1',
        eventType: 'receipt_delivery',
        channel: 'sms',
        language: 'en',
        subject: null,
        body: 'PROPLA: Cash receipt for Rs{{amount}} ({{service_name}}). Receipt: {{receipt_id}}. View: app.propla.in',
        version: 1,
    },
    {
        templateCode: 'receipt_delivery_sms_hi_v1',
        eventType: 'receipt_delivery',
        channel: 'sms',
        language: 'hi',
        subject: null,
        body: 'PROPLA: \u20B9{{amount}} \u0915\u0940 \u0928\u0915\u0926 \u0930\u0938\u0940\u0926 ({{service_name}})\u0964 \u0930\u0938\u0940\u0926: {{receipt_id}}\u0964 \u0926\u0947\u0916\u0947\u0902: app.propla.in',
        version: 1,
    },
];
async function seedNotificationTemplates(prisma) {
    for (const tpl of templates) {
        await prisma.notificationTemplate.upsert({
            where: { templateCode: tpl.templateCode },
            update: {
                eventType: tpl.eventType,
                channel: tpl.channel,
                language: tpl.language,
                subject: tpl.subject ?? null,
                body: tpl.body,
                version: tpl.version,
                whatsappTemplateName: tpl.whatsappTemplateName ?? null,
            },
            create: {
                templateCode: tpl.templateCode,
                eventType: tpl.eventType,
                channel: tpl.channel,
                language: tpl.language,
                subject: tpl.subject ?? null,
                body: tpl.body,
                version: tpl.version,
                whatsappTemplateName: tpl.whatsappTemplateName ?? null,
            },
        });
    }
    console.log(`Seeded ${templates.length} notification templates`);
}
//# sourceMappingURL=notification-templates.seed.js.map
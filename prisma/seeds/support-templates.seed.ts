// Story 10.3: Default Communication Templates Seed Data
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TEMPLATES = [
  {
    category: 'DOCUMENT_REQUESTS' as const,
    templateTextEn: 'Dear [Customer Name], we need the following documents for your [Service Type] service. Please upload them at your earliest convenience.',
    templateTextHi: 'प्रिय [Customer Name], आपकी [Service Type] सेवा के लिए हमें निम्नलिखित दस्तावेज़ चाहिए। कृपया जल्द से जल्द अपलोड करें।',
    placeholders: ['Customer Name', 'Service Type'],
  },
  {
    category: 'DOCUMENT_REQUESTS' as const,
    templateTextEn: 'Dear [Customer Name], could you please clarify the property details for your [Service Type] request?',
    templateTextHi: 'प्रिय [Customer Name], कृपया अपने [Service Type] अनुरोध के लिए संपत्ति विवरण स्पष्ट करें।',
    placeholders: ['Customer Name', 'Service Type'],
  },
  {
    category: 'TIMELINE_UPDATES' as const,
    templateTextEn: 'Dear [Customer Name], there is a delay in your [Service Type] due to a government office closure. Your new expected date is [SLA Date].',
    templateTextHi: 'प्रिय [Customer Name], सरकारी कार्यालय बंद होने के कारण आपकी [Service Type] में देरी हो रही है। आपकी नई अपेक्षित तिथि [SLA Date] है।',
    placeholders: ['Customer Name', 'Service Type', 'SLA Date'],
  },
  {
    category: 'TIMELINE_UPDATES' as const,
    templateTextEn: 'Dear [Customer Name], here is an update on your [Service Type]: Your service is on track. Agent [Agent Name] is handling your case. Expected completion by [SLA Date].',
    templateTextHi: 'प्रिय [Customer Name], आपकी [Service Type] का अपडेट: सेवा ट्रैक पर है। एजेंट [Agent Name] आपका मामला संभाल रहे हैं। [SLA Date] तक पूर्ण होने की उम्मीद है।',
    placeholders: ['Customer Name', 'Service Type', 'Agent Name', 'SLA Date'],
  },
  {
    category: 'ISSUE_RESOLUTION' as const,
    templateTextEn: 'Dear [Customer Name], we are pleased to inform you that the issue with your [Service Type] has been resolved. Please let us know if you need further assistance.',
    templateTextHi: 'प्रिय [Customer Name], हमें आपको सूचित करते हुए खुशी हो रही है कि आपकी [Service Type] की समस्या हल हो गई है। यदि और सहायता चाहिए तो कृपया बताएं।',
    placeholders: ['Customer Name', 'Service Type'],
  },
  {
    category: 'ISSUE_RESOLUTION' as const,
    templateTextEn: 'Dear [Customer Name], your case regarding [Service Type] has been escalated to our Operations team for priority handling. You will receive an update within 24 hours.',
    templateTextHi: 'प्रिय [Customer Name], [Service Type] से संबंधित आपका मामला प्राथमिकता से निपटने के लिए हमारी संचालन टीम को भेजा गया है। आपको 24 घंटे में अपडेट मिलेगा।',
    placeholders: ['Customer Name', 'Service Type'],
  },
  {
    category: 'GENERAL_INQUIRY' as const,
    templateTextEn: 'Dear [Customer Name], thank you for reaching out. We are looking into your inquiry regarding [Service Type] and will get back to you shortly.',
    templateTextHi: 'प्रिय [Customer Name], संपर्क करने के लिए धन्यवाद। हम आपकी [Service Type] से संबंधित पूछताछ पर काम कर रहे हैं और जल्द ही आपसे संपर्क करेंगे।',
    placeholders: ['Customer Name', 'Service Type'],
  },
];

export async function seedSupportTemplates(createdBy: string) {
  console.info('Seeding support communication templates...');

  for (const template of DEFAULT_TEMPLATES) {
    await prisma.supportTemplate.create({
      data: {
        ...template,
        createdBy,
      },
    });
  }

  console.info(`${DEFAULT_TEMPLATES.length} support templates seeded successfully.`);
}

// Story 13-5: POA Template Generation & Customization Service
import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { getStorage } from 'firebase-admin/storage';
import crypto from 'crypto';

const POA_TEMPLATES = {
  mutation: {
    title: 'POWER OF ATTORNEY FOR PROPERTY MUTATION',
    scopeClause:
      'to apply for and complete the mutation/transfer of property records in the revenue/municipal authority records',
  },
  registry: {
    title: 'POWER OF ATTORNEY FOR PROPERTY REGISTRATION',
    scopeClause:
      'to execute, sign and register sale deed, transfer deed or any other instrument of conveyance',
  },
  tax_payment: {
    title: 'POWER OF ATTORNEY FOR PROPERTY TAX MATTERS',
    scopeClause:
      'to pay property taxes, obtain tax receipts, and represent before municipal/revenue authorities for tax matters',
  },
  general: {
    title: 'GENERAL POWER OF ATTORNEY FOR PROPERTY MATTERS',
    scopeClause:
      'to handle all property-related legal, administrative, and financial matters',
  },
} as const;

export type PoaServiceType = keyof typeof POA_TEMPLATES;

export class PoaTemplateService {
  constructor(private prisma: PrismaClient) {}

  async generatePoa(params: {
    customerId: string;
    serviceRequestId?: string;
    attorneyName: string;
    attorneyAddress: string;
    attorneyPhone: string;
    scopeOfAuthority: string[];
    serviceType: PoaServiceType;
    validityStartDate: Date;
    validityEndDate: Date;
    cityId: string;
  }) {
    // Create POA record
    const poa = await this.prisma.poaDocument.create({
      data: {
        id: crypto.randomUUID(),
        customerId: params.customerId,
        serviceRequestId: params.serviceRequestId || null,
        attorneyName: params.attorneyName,
        attorneyAddress: params.attorneyAddress,
        attorneyPhone: params.attorneyPhone,
        scopeOfAuthority: JSON.stringify(params.scopeOfAuthority),
        serviceType: params.serviceType,
        validityStartDate: params.validityStartDate,
        validityEndDate: params.validityEndDate,
        cityId: params.cityId,
        status: 'draft',
      },
    });

    // TODO: User model not in schema — using attorney details from params
    // Customer info should be resolved by the caller or from Firebase Auth
    const pdfBuffer = await this.generatePoaPdf({
      template: POA_TEMPLATES[params.serviceType],
      principalName: 'Principal', // TODO: resolve customer name from auth system
      principalAddress: '', // TODO: resolve customer address from auth system
      attorneyName: params.attorneyName,
      attorneyAddress: params.attorneyAddress,
      scopeOfAuthority: params.scopeOfAuthority,
      validFrom: params.validityStartDate,
      validUntil: params.validityEndDate,
    });

    // Upload to Firebase Storage
    const storagePath = `poa/${params.cityId}/${params.customerId}/${poa.id}.pdf`;
    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
    await file.save(pdfBuffer, { contentType: 'application/pdf' });

    // Update record with URL
    await this.prisma.poaDocument.update({
      where: { id: poa.id },
      data: { documentUrl: storagePath, status: 'generated' },
    });

    return { poaId: poa.id, documentUrl: storagePath };
  }

  private async generatePoaPdf(data: {
    template: { title: string; scopeClause: string };
    principalName: string;
    principalAddress: string;
    attorneyName: string;
    attorneyAddress: string;
    scopeOfAuthority: string[];
    validFrom: Date;
    validUntil: Date;
  }): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.fontSize(16).text(data.template.title, { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(11);
      doc.text(
        `I, ${data.principalName}, residing at ${data.principalAddress}, hereby appoint:`
      );
      doc.moveDown();
      doc.text(
        `${data.attorneyName}, residing at ${data.attorneyAddress}`
      );
      doc.moveDown();
      doc.text(
        `as my lawful attorney ${data.template.scopeClause}.`
      );
      doc.moveDown();
      doc.text('Scope of Authority:', { underline: true });
      data.scopeOfAuthority.forEach((scope) => {
        doc.text(`  - ${scope}`);
      });
      doc.moveDown();
      doc.text(
        `Validity: From ${data.validFrom.toLocaleDateString()} to ${data.validUntil.toLocaleDateString()}`
      );
      doc.moveDown(2);
      doc.text(
        '_________________________          _________________________'
      );
      doc.text(
        'Principal (Signature)               Witness (Signature)'
      );

      doc.end();
    });
  }

  async getCustomerPoas(customerId: string) {
    return this.prisma.poaDocument.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

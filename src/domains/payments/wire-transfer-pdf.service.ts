// Story 13-2: Wire Transfer Instruction PDF Generator
import PDFDocument from 'pdfkit';

export interface WireTransferPdfData {
  referenceCode: string;
  bankName: string;
  swiftCode: string;
  accountNumber: string;
  amountPaise: number;
  customerName: string;
}

export function generateWireTransferPdf(data: WireTransferPdfData): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // Header
    doc.fontSize(18).text('Wire Transfer Instructions', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('Property Legal Agent', { align: 'center' });
    doc.moveDown(2);

    // Reference code (prominent)
    doc.fontSize(12).text('IMPORTANT: Include this reference code in your wire transfer remarks:');
    doc.moveDown(0.5);
    doc.fontSize(16).fillColor('blue').text(data.referenceCode, { underline: true });
    doc.fillColor('black');
    doc.moveDown(2);

    // Bank details
    doc.fontSize(12);
    doc.text('Bank Details:', { underline: true });
    doc.moveDown(0.5);
    doc.text(`Bank Name: ${data.bankName}`);
    doc.text(`SWIFT Code: ${data.swiftCode}`);
    doc.text(`Account Number: ${data.accountNumber}`);
    doc.text(`Account Name: Property Legal Agent Services Pvt. Ltd.`);
    doc.moveDown();

    // Amount
    doc.text('Payment Details:', { underline: true });
    doc.moveDown(0.5);
    doc.text(`Amount: INR ${(data.amountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    doc.text(`Customer: ${data.customerName}`);
    doc.moveDown(2);

    // Instructions
    doc.text('Instructions:', { underline: true });
    doc.moveDown(0.5);
    doc.text('1. Initiate a wire transfer from your international bank account.');
    doc.text('2. Enter the bank details provided above.');
    doc.text(`3. Include "${data.referenceCode}" in the transfer remarks/reference field.`);
    doc.text('4. Once the transfer is initiated, upload your transfer receipt in the app.');
    doc.text('5. Our team will reconcile the payment within 7 business days.');
    doc.moveDown(2);

    // Footer
    doc.fontSize(10).fillColor('grey');
    doc.text(
      'Note: Exchange rate fluctuations and bank fees may result in a slightly different received amount. Any variance will be communicated to you.',
      { align: 'center' }
    );
    doc.moveDown();
    doc.text(`Generated on: ${new Date().toISOString().split('T')[0]}`, {
      align: 'center',
    });

    doc.end();
  });
}

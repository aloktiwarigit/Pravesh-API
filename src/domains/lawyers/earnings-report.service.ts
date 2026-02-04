import PDFDocument from 'pdfkit';

/**
 * Story 12-10: PDF Earnings Report Generation
 *
 * Generates a PDF earnings report for a lawyer, listing all payouts
 * for a given month and year with fee breakdowns.
 */

interface PayoutRecord {
  legalCase: {
    caseNumber: string;
  };
  grossFeeInPaise: number;
  commissionInPaise: number;
  netPayoutInPaise: number;
  payoutStatus: string;
  createdAt: Date;
}

export async function generateEarningsReportPdf(
  lawyerName: string,
  month: number,
  year: number,
  payouts: PayoutRecord[],
): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Header
    doc.fontSize(20).text('Earnings Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).text(`Lawyer: ${lawyerName}`, { align: 'center' });
    doc.fontSize(12).text(`Period: ${String(month).padStart(2, '0')}/${year}`, { align: 'center' });
    doc.moveDown(1);

    // Summary
    const totalGross = payouts.reduce((sum, p) => sum + p.grossFeeInPaise, 0);
    const totalCommission = payouts.reduce((sum, p) => sum + p.commissionInPaise, 0);
    const totalNet = payouts.reduce((sum, p) => sum + p.netPayoutInPaise, 0);

    doc.fontSize(12).text('Summary', { underline: true });
    doc.fontSize(10);
    doc.text(`Total Cases: ${payouts.length}`);
    doc.text(`Total Gross Fees: Rs. ${(totalGross / 100).toLocaleString('en-IN')}`);
    doc.text(`Total Commission: Rs. ${(totalCommission / 100).toLocaleString('en-IN')}`);
    doc.text(`Total Net Payout: Rs. ${(totalNet / 100).toLocaleString('en-IN')}`);
    doc.moveDown(1);

    // Table header
    doc.fontSize(10).text(
      'Case #         |  Date       |  Gross Fee   |  Commission  |  Net Payout  |  Status',
    );
    doc.text('------------------------------------------------------------------------');

    // Rows
    for (const payout of payouts) {
      const row = [
        payout.legalCase.caseNumber.padEnd(15),
        payout.createdAt.toISOString().split('T')[0],
        `Rs. ${(payout.grossFeeInPaise / 100).toFixed(0).padStart(8)}`,
        `Rs. ${(payout.commissionInPaise / 100).toFixed(0).padStart(8)}`,
        `Rs. ${(payout.netPayoutInPaise / 100).toFixed(0).padStart(8)}`,
        payout.payoutStatus,
      ].join(' | ');

      doc.fontSize(8).text(row);
    }

    doc.moveDown(2);

    // Footer
    doc.fontSize(8).text(
      `Generated on ${new Date().toISOString()} | Property Legal Agent Platform`,
      { align: 'center' },
    );

    doc.end();
  });
}

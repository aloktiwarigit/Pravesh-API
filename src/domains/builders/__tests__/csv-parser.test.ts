// ============================================================
// Story 11-2: CSV Parser — Tests
// ============================================================

import { parseBuyerCsv } from '../csv-parser';

describe('parseBuyerCsv', () => {
  it('parses valid CSV with all rows valid', () => {
    const csv = [
      'unit_number,buyer_name,buyer_phone,buyer_email',
      'A-101,Rahul Sharma,+919876543210,rahul@example.com',
      'A-102,Priya Patel,+919876543211,priya@example.com',
      'A-103,Amit Kumar,+919876543212,',
    ].join('\n');

    const result = parseBuyerCsv(csv);

    expect(result.validRows).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows[0].unit_number).toBe('A-101');
    expect(result.validRows[0].buyer_name).toBe('Rahul Sharma');
    expect(result.validRows[0].buyer_phone).toBe('+919876543210');
  });

  it('reports error for invalid phone numbers', () => {
    const csv = [
      'unit_number,buyer_name,buyer_phone',
      'A-101,Rahul Sharma,9876543210', // missing +91
    ].join('\n');

    const result = parseBuyerCsv(csv);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('buyer_phone');
    expect(result.errors[0].row).toBe(2);
  });

  it('detects duplicate unit numbers within CSV', () => {
    const csv = [
      'unit_number,buyer_name,buyer_phone',
      'A-101,Rahul Sharma,+919876543210',
      'A-101,Priya Patel,+919876543211',
    ].join('\n');

    const result = parseBuyerCsv(csv);

    expect(result.validRows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Duplicate unit number');
  });

  it('rejects CSV with more than 500 rows', () => {
    const header = 'unit_number,buyer_name,buyer_phone';
    const rows = Array.from({ length: 501 }, (_, i) =>
      `A-${i + 1},Buyer ${i + 1},+91987654${String(i).padStart(4, '0')}`
    );
    const csv = [header, ...rows].join('\n');

    const result = parseBuyerCsv(csv);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Maximum 500 units');
  });

  it('reports missing required fields', () => {
    const csv = [
      'unit_number,buyer_name,buyer_phone',
      ',Rahul Sharma,+919876543210',  // missing unit_number
      'A-102,,+919876543211',          // missing buyer_name
    ].join('\n');

    const result = parseBuyerCsv(csv);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
  });

  it('handles empty CSV', () => {
    const csv = 'unit_number,buyer_name,buyer_phone';
    const result = parseBuyerCsv(csv);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

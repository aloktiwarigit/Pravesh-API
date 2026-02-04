// ============================================================
// Story 11-2: CSV Parsing & Validation for Buyer List Upload
// ============================================================

interface CsvRow {
  unit_number: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_email?: string;
}

export interface CsvRowError {
  row: number;
  field: string;
  message: string;
}

export interface CsvParseResult {
  validRows: CsvRow[];
  errors: CsvRowError[];
  encodingWarning?: string;
}

const PHONE_REGEX = /^\+91\d{10}$/;
const MAX_UNITS = 500;

/**
 * Parses a buyer CSV buffer and validates each row.
 *
 * Expected columns: unit_number, buyer_name, buyer_phone, buyer_email (optional)
 *
 * AC5: Phone validated as Indian format (+91 10 digits).
 * AC6: If >500 units, rejected with max-limit message.
 * AC6: Row-by-row error reporting for invalid rows.
 * AC8: Duplicate unit_number within the CSV detected.
 */
export function parseBuyerCsv(csvString: string): CsvParseResult {
  const errors: CsvRowError[] = [];

  const lines = csvString.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return {
      validRows: [],
      errors: [{ row: 0, field: 'file', message: 'CSV file is empty or has no data rows' }],
    };
  }

  // Parse header
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const unitNumberIdx = header.indexOf('unit_number');
  const buyerNameIdx = header.indexOf('buyer_name');
  const buyerPhoneIdx = header.indexOf('buyer_phone');
  const buyerEmailIdx = header.indexOf('buyer_email');

  if (unitNumberIdx === -1 || buyerNameIdx === -1 || buyerPhoneIdx === -1) {
    return {
      validRows: [],
      errors: [
        {
          row: 0,
          field: 'header',
          message: 'CSV must have columns: unit_number, buyer_name, buyer_phone',
        },
      ],
    };
  }

  const dataLines = lines.slice(1).filter((line) => line.trim().length > 0);

  if (dataLines.length > MAX_UNITS) {
    return {
      validRows: [],
      errors: [
        {
          row: 0,
          field: 'file',
          message: `Maximum ${MAX_UNITS} units per upload. File has ${dataLines.length} rows. Please split into multiple files.`,
        },
      ],
    };
  }

  const validRows: CsvRow[] = [];
  const unitNumbers = new Set<string>();

  for (let i = 0; i < dataLines.length; i++) {
    const cols = dataLines[i].split(',').map((c) => c.trim());
    const rowNum = i + 2; // 1-indexed + header row

    const unitNumber = cols[unitNumberIdx] || '';
    const buyerName = cols[buyerNameIdx] || '';
    const buyerPhone = cols[buyerPhoneIdx] || '';
    const buyerEmail = buyerEmailIdx >= 0 ? cols[buyerEmailIdx] || undefined : undefined;

    if (!unitNumber) {
      errors.push({ row: rowNum, field: 'unit_number', message: 'Unit number is required' });
      continue;
    }
    if (unitNumbers.has(unitNumber)) {
      errors.push({
        row: rowNum,
        field: 'unit_number',
        message: `Duplicate unit number: ${unitNumber}`,
      });
      continue;
    }
    if (!buyerName) {
      errors.push({ row: rowNum, field: 'buyer_name', message: 'Buyer name is required' });
      continue;
    }
    if (!PHONE_REGEX.test(buyerPhone)) {
      errors.push({
        row: rowNum,
        field: 'buyer_phone',
        message: 'Phone must be +91 followed by 10 digits',
      });
      continue;
    }

    unitNumbers.add(unitNumber);
    validRows.push({
      unit_number: unitNumber,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      buyer_email: buyerEmail,
    });
  }

  return { validRows, errors };
}

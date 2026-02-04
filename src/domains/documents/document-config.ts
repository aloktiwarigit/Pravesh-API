// Story 6.9: Critical document types configuration for WhatsApp delivery

export const CRITICAL_DOCUMENT_TYPES = [
  'registered_sale_deed',
  'mutation_order',
  'encumbrance_certificate',
  'completion_certificate',
  'legal_opinion',
] as const;

export type CriticalDocumentType = typeof CRITICAL_DOCUMENT_TYPES[number];

export function isCriticalDocument(docType: string): boolean {
  return CRITICAL_DOCUMENT_TYPES.includes(docType as CriticalDocumentType);
}

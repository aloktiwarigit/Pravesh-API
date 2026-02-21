/**
 * Static mapping from Flutter catalog slugs (snake_case) to
 * ServiceDefinition codes (kebab-case) stored in the database.
 *
 * Unmapped slugs will be auto-created as new ServiceDefinitions.
 */

export const FLUTTER_SLUG_TO_SERVICE_CODE: Record<string, string> = {
  title_search: 'title-search',
  encumbrance: 'encumbrance-certificate',
  rera_verification: 'rera-registration',
  registration: 'sale-deed-registration',
  sale_deed: 'sale-deed-registration',
  mutation: 'lda-mutation',
  legal_opinion: 'legal-opinion',
  poa: 'nri-power-of-attorney',
  due_diligence: 'title-search', // maps to title search (comprehensive)
  rent_agreement: 'lease-deed-registration',
  property_valuation: 'property-valuation',
  partition_deed: 'partition-deed',
};

/**
 * Human-readable names for auto-creating ServiceDefinitions when a slug
 * is not found in the database. Only used as a fallback.
 */
export const SLUG_DISPLAY_NAMES: Record<string, string> = {
  title_search: 'Title Search & Verification',
  encumbrance: 'Encumbrance Certificate',
  rera_verification: 'RERA Verification',
  registration: 'Property Registration / Sale Deed',
  sale_deed: 'Property Registration / Sale Deed',
  mutation: 'Property Mutation',
  legal_opinion: 'Legal Opinion',
  poa: 'Power of Attorney',
  due_diligence: 'Property Due Diligence',
  rent_agreement: 'Rent Agreement',
  property_valuation: 'Property Valuation',
  partition_deed: 'Partition Deed',
};

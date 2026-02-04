// Story 13-6: Indian Embassy / Consulate Data Configuration

export interface EmbassyInfo {
  country: string;
  city: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  poaProcessSteps: string[];
  requiredDocuments: string[];
}

export const INDIAN_EMBASSIES: EmbassyInfo[] = [
  {
    country: 'United States',
    city: 'Washington DC',
    name: 'Embassy of India, Washington DC',
    address: '2107 Massachusetts Avenue NW, Washington, DC 20008',
    phone: '+1-202-939-7000',
    email: 'cons.washington@mea.gov.in',
    website: 'https://www.indianembassyusa.gov.in',
    poaProcessSteps: [
      'Book appointment online via BLS/VFS portal',
      'Prepare POA draft, passport, and address proof',
      'Visit embassy/consulate on appointment date',
      'Submit documents and pay notarization fees',
      'Collect notarized POA (typically 3-5 business days)',
    ],
    requiredDocuments: [
      'POA draft (printed)',
      'Valid passport (original + copy)',
      'Address proof',
      'OCI/PIO card (if applicable)',
      'Passport-size photos',
    ],
  },
  {
    country: 'United States',
    city: 'New York',
    name: 'Consulate General of India, New York',
    address: '3 East 64th Street, New York, NY 10065',
    phone: '+1-212-774-0600',
    email: 'cons.newyork@mea.gov.in',
    website: 'https://www.indiainnewyork.gov.in',
    poaProcessSteps: [
      'Book appointment online via BLS/VFS portal',
      'Prepare POA draft, passport, and address proof',
      'Visit consulate on appointment date',
      'Submit documents and pay notarization fees',
      'Collect notarized POA (typically 3-5 business days)',
    ],
    requiredDocuments: [
      'POA draft (printed)',
      'Valid passport (original + copy)',
      'Address proof',
      'OCI/PIO card (if applicable)',
      'Passport-size photos',
    ],
  },
  {
    country: 'United Arab Emirates',
    city: 'Dubai',
    name: 'Consulate General of India, Dubai',
    address: 'Al Hamriya, Khalid Bin Al Waleed Road, Dubai',
    phone: '+971-4-3971222',
    email: 'cons.dubai@mea.gov.in',
    website: 'https://www.cgidubai.gov.in',
    poaProcessSteps: [
      'Book appointment via BLS International portal',
      'Prepare POA draft with two witnesses',
      'Visit consulate on appointment date',
      'Attestation and notarization',
      'Collect attested POA (typically 2-3 business days)',
    ],
    requiredDocuments: [
      'POA draft',
      'Valid passport',
      'UAE residence visa',
      'Emirates ID copy',
      'Passport photos',
    ],
  },
  {
    country: 'United Arab Emirates',
    city: 'Abu Dhabi',
    name: 'Embassy of India, Abu Dhabi',
    address: 'Plot No. 10, Sector W-59/02, Abu Dhabi',
    phone: '+971-2-4492700',
    email: 'amb.abudhabi@mea.gov.in',
    website: 'https://www.indembassyuae.gov.in',
    poaProcessSteps: [
      'Book appointment via BLS International portal',
      'Prepare POA draft with two witnesses',
      'Visit embassy on appointment date',
      'Attestation and notarization',
      'Collect attested POA (typically 2-3 business days)',
    ],
    requiredDocuments: [
      'POA draft',
      'Valid passport',
      'UAE residence visa',
      'Emirates ID copy',
      'Passport photos',
    ],
  },
  {
    country: 'United Kingdom',
    city: 'London',
    name: 'High Commission of India, London',
    address: 'India House, Aldwych, London WC2B 4NA',
    phone: '+44-20-78368484',
    email: 'hoc.london@mea.gov.in',
    website: 'https://www.hcilondon.gov.in',
    poaProcessSteps: [
      'Book appointment via VFS Global portal',
      'Prepare POA draft, passport, and proof of residence',
      'Visit High Commission on appointment date',
      'Submit documents for attestation',
      'Collect attested POA (typically 5-7 business days)',
    ],
    requiredDocuments: [
      'POA draft (printed)',
      'Valid passport (original + copy)',
      'UK visa/BRP',
      'Proof of address in UK',
      'Passport-size photos',
    ],
  },
  {
    country: 'Singapore',
    city: 'Singapore',
    name: 'High Commission of India, Singapore',
    address: '31 Grange Road, Singapore 239702',
    phone: '+65-67376777',
    email: 'hoc.singapore@mea.gov.in',
    website: 'https://www.hcisingapore.gov.in',
    poaProcessSteps: [
      'Book appointment via the High Commission website',
      'Prepare POA draft and supporting documents',
      'Visit High Commission on appointment date',
      'Submit documents for notarization',
      'Collect notarized POA (typically 3-5 business days)',
    ],
    requiredDocuments: [
      'POA draft (printed)',
      'Valid passport (original + copy)',
      'Singapore work permit/EP/PR card',
      'Proof of address',
      'Passport-size photos',
    ],
  },
  {
    country: 'Canada',
    city: 'Ottawa',
    name: 'High Commission of India, Ottawa',
    address: '10 Springfield Road, Ottawa, Ontario K1M 1C9',
    phone: '+1-613-7443751',
    email: 'hoc.ottawa@mea.gov.in',
    website: 'https://www.hciottawa.gov.in',
    poaProcessSteps: [
      'Book appointment via BLS International portal',
      'Prepare POA draft, passport, and address proof',
      'Visit High Commission on appointment date',
      'Submit documents for notarization',
      'Collect notarized POA (typically 5-7 business days)',
    ],
    requiredDocuments: [
      'POA draft (printed)',
      'Valid passport (original + copy)',
      'Canadian visa/PR card',
      'Address proof in Canada',
      'Passport-size photos',
    ],
  },
  {
    country: 'Australia',
    city: 'Canberra',
    name: 'High Commission of India, Canberra',
    address: '3-5 Moonah Place, Yarralumla, ACT 2600',
    phone: '+61-2-62733999',
    email: 'hoc.canberra@mea.gov.in',
    website: 'https://www.hcindia-au.gov.in',
    poaProcessSteps: [
      'Book appointment via VFS Global portal',
      'Prepare POA draft, passport, and supporting documents',
      'Visit High Commission on appointment date',
      'Submit documents for attestation',
      'Collect attested POA (typically 5-7 business days)',
    ],
    requiredDocuments: [
      'POA draft (printed)',
      'Valid passport (original + copy)',
      'Australian visa',
      'Proof of address in Australia',
      'Passport-size photos',
    ],
  },
];

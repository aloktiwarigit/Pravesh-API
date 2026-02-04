/**
 * Epic 9 Story 9.11: Badge Definitions (Bilingual)
 * Each badge has icon, description, and celebratory message in English + Hindi.
 * AC9: Playful language — "You're on fire!", "Almost there!", "Keep it up!"
 */

export interface BadgeDefinition {
  type: string;
  nameEn: string;
  nameHi: string;
  descriptionEn: string;
  descriptionHi: string;
  iconUrl: string;
  celebrationMessageEn: string;
  celebrationMessageHi: string;
}

export const BADGE_DEFINITIONS: Record<string, BadgeDefinition> = {
  FIRST_REFERRAL: {
    type: 'FIRST_REFERRAL',
    nameEn: 'First Referral',
    nameHi: 'पहला रेफरल',
    descriptionEn: 'Made your first successful referral!',
    descriptionHi: 'आपका पहला सफल रेफरल!',
    iconUrl: '/assets/badges/first-referral.png',
    celebrationMessageEn: "You're on fire! Your first referral is in!",
    celebrationMessageHi: 'बधाई हो! आपका पहला रेफरल आ गया!',
  },
  FIVE_REFERRALS: {
    type: 'FIVE_REFERRALS',
    nameEn: '5 Referrals',
    nameHi: '5 रेफरल',
    descriptionEn: 'Reached 5 successful referrals!',
    descriptionHi: '5 सफल रेफरल पूरे!',
    iconUrl: '/assets/badges/five-referrals.png',
    celebrationMessageEn: 'Keep it up! You hit 5 referrals!',
    celebrationMessageHi: 'शानदार! 5 रेफरल पूरे हो गए!',
  },
  FIRST_PAYOUT: {
    type: 'FIRST_PAYOUT',
    nameEn: 'First Payout',
    nameHi: 'पहला भुगतान',
    descriptionEn: 'Received your first commission payout!',
    descriptionHi: 'आपका पहला कमीशन भुगतान प्राप्त!',
    iconUrl: '/assets/badges/first-payout.png',
    celebrationMessageEn: 'Cash in! Your first payout is here!',
    celebrationMessageHi: 'बधाई! आपका पहला भुगतान आ गया!',
  },
  SILVER_TIER: {
    type: 'SILVER_TIER',
    nameEn: 'Silver Achiever',
    nameHi: 'सिल्वर अचीवर',
    descriptionEn: 'Promoted to Silver tier!',
    descriptionHi: 'सिल्वर टियर में प्रमोट!',
    iconUrl: '/assets/badges/silver-tier.png',
    celebrationMessageEn: 'Almost there! Silver tier unlocked!',
    celebrationMessageHi: 'शानदार! सिल्वर टियर अनलॉक!',
  },
  GOLD_TIER: {
    type: 'GOLD_TIER',
    nameEn: 'Gold Champion',
    nameHi: 'गोल्ड चैंपियन',
    descriptionEn: 'Promoted to Gold tier - the highest level!',
    descriptionHi: 'गोल्ड टियर - सर्वोच्च स्तर!',
    iconUrl: '/assets/badges/gold-tier.png',
    celebrationMessageEn: "You're a champion! Gold tier achieved!",
    celebrationMessageHi: 'आप चैंपियन हैं! गोल्ड टियर हासिल!',
  },
  TOP_10_LEADERBOARD: {
    type: 'TOP_10_LEADERBOARD',
    nameEn: 'Top 10',
    nameHi: 'टॉप 10',
    descriptionEn: 'Ranked in the Top 10 on the city leaderboard!',
    descriptionHi: 'शहर लीडरबोर्ड पर टॉप 10 में!',
    iconUrl: '/assets/badges/top-10.png',
    celebrationMessageEn: "You're on fire! Top 10 in your city!",
    celebrationMessageHi: 'जबरदस्त! आप शहर में टॉप 10 में!',
  },
  HUNDRED_REFERRALS_LIFETIME: {
    type: 'HUNDRED_REFERRALS_LIFETIME',
    nameEn: 'Century Club',
    nameHi: 'सेंचुरी क्लब',
    descriptionEn: '100 lifetime referrals - legendary status!',
    descriptionHi: '100 रेफरल - लीजेंड स्टेटस!',
    iconUrl: '/assets/badges/century-club.png',
    celebrationMessageEn: 'LEGENDARY! 100 referrals and counting!',
    celebrationMessageHi: 'लीजेंड! 100 रेफरल पूरे!',
  },
};

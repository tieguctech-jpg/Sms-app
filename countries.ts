export interface Country {
  code: string;
  name: string;
  flag: string;
  tier: 1 | 2 | 3;
  priceMultiplier: number;
  availableNumbers: number;
  status: "active" | "limited" | "unavailable";
}

export const COUNTRIES: Country[] = [
  // Tier 1
  { code: "US", name: "United States", flag: "🇺🇸", tier: 1, priceMultiplier: 1.0, availableNumbers: 420, status: "active" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", tier: 1, priceMultiplier: 1.0, availableNumbers: 380, status: "active" },
  { code: "CA", name: "Canada", flag: "🇨🇦", tier: 1, priceMultiplier: 1.0, availableNumbers: 290, status: "active" },
  { code: "DE", name: "Germany", flag: "🇩🇪", tier: 1, priceMultiplier: 1.0, availableNumbers: 260, status: "active" },
  { code: "FR", name: "France", flag: "🇫🇷", tier: 1, priceMultiplier: 1.0, availableNumbers: 240, status: "active" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", tier: 1, priceMultiplier: 1.0, availableNumbers: 180, status: "active" },

  // Tier 2
  { code: "AU", name: "Australia", flag: "🇦🇺", tier: 2, priceMultiplier: 0.9, availableNumbers: 210, status: "active" },
  { code: "SE", name: "Sweden", flag: "🇸🇪", tier: 2, priceMultiplier: 0.9, availableNumbers: 160, status: "active" },
  { code: "NO", name: "Norway", flag: "🇳🇴", tier: 2, priceMultiplier: 0.9, availableNumbers: 140, status: "active" },
  { code: "FI", name: "Finland", flag: "🇫🇮", tier: 2, priceMultiplier: 0.9, availableNumbers: 130, status: "active" },
  { code: "ES", name: "Spain", flag: "🇪🇸", tier: 2, priceMultiplier: 0.9, availableNumbers: 190, status: "limited" },
  { code: "IT", name: "Italy", flag: "🇮🇹", tier: 2, priceMultiplier: 0.9, availableNumbers: 170, status: "active" },

  // Tier 3
  { code: "BR", name: "Brazil", flag: "🇧🇷", tier: 3, priceMultiplier: 0.6, availableNumbers: 320, status: "active" },
  { code: "IN", name: "India", flag: "🇮🇳", tier: 3, priceMultiplier: 0.6, availableNumbers: 580, status: "active" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", tier: 3, priceMultiplier: 0.6, availableNumbers: 190, status: "active" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", tier: 3, priceMultiplier: 0.6, availableNumbers: 240, status: "limited" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", tier: 3, priceMultiplier: 0.6, availableNumbers: 280, status: "active" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", tier: 3, priceMultiplier: 0.6, availableNumbers: 350, status: "active" },
];

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

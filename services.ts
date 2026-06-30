export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  color: string;
  basePrice: number;
  successRate: number;
  availableNumbers: number;
  countryCount: number;
  popular?: boolean;
}

export type ServiceCategory =
  | "Social Media"
  | "Messaging"
  | "Email"
  | "Shopping"
  | "Entertainment"
  | "Gaming"
  | "Crypto & Finance";

export const CATEGORY_COLORS: Record<ServiceCategory, string> = {
  "Social Media": "#1877F2",
  Messaging: "#7289DA",
  Email: "#EA4335",
  Shopping: "#FF9900",
  Entertainment: "#E50914",
  Gaming: "#00A651",
  "Crypto & Finance": "#C8A97E",
};

export const SERVICES: Service[] = [
  // Social Media
  { id: "whatsapp", name: "WhatsApp", category: "Social Media", color: "#25D366", basePrice: 0.5, successRate: 98, availableNumbers: 1240, countryCount: 18, popular: true },
  { id: "telegram", name: "Telegram", category: "Social Media", color: "#2AABEE", basePrice: 0.4, successRate: 97, availableNumbers: 980, countryCount: 18, popular: true },
  { id: "facebook", name: "Facebook", category: "Social Media", color: "#1877F2", basePrice: 0.8, successRate: 95, availableNumbers: 760, countryCount: 18 },
  { id: "instagram", name: "Instagram", category: "Social Media", color: "#E1306C", basePrice: 0.9, successRate: 94, availableNumbers: 640, countryCount: 15, popular: true },
  { id: "tiktok", name: "TikTok", category: "Social Media", color: "#010101", basePrice: 0.6, successRate: 96, availableNumbers: 820, countryCount: 16 },
  { id: "snapchat", name: "Snapchat", category: "Social Media", color: "#FFFC00", basePrice: 0.7, successRate: 93, availableNumbers: 510, countryCount: 14 },
  { id: "twitter", name: "X (Twitter)", category: "Social Media", color: "#000000", basePrice: 1.0, successRate: 92, availableNumbers: 430, countryCount: 15 },
  { id: "threads", name: "Threads", category: "Social Media", color: "#000000", basePrice: 0.8, successRate: 91, availableNumbers: 380, countryCount: 12 },
  { id: "linkedin", name: "LinkedIn", category: "Social Media", color: "#0A66C2", basePrice: 1.2, successRate: 90, availableNumbers: 290, countryCount: 13 },
  { id: "pinterest", name: "Pinterest", category: "Social Media", color: "#E60023", basePrice: 0.6, successRate: 94, availableNumbers: 460, countryCount: 14 },

  // Messaging
  { id: "discord", name: "Discord", category: "Messaging", color: "#5865F2", basePrice: 0.5, successRate: 97, availableNumbers: 720, countryCount: 16, popular: true },
  { id: "signal", name: "Signal", category: "Messaging", color: "#3A76F0", basePrice: 0.4, successRate: 98, availableNumbers: 640, countryCount: 15 },
  { id: "viber", name: "Viber", category: "Messaging", color: "#7360F2", basePrice: 0.5, successRate: 95, availableNumbers: 480, countryCount: 14 },
  { id: "wechat", name: "WeChat", category: "Messaging", color: "#07C160", basePrice: 1.5, successRate: 89, availableNumbers: 240, countryCount: 10 },
  { id: "line", name: "LINE", category: "Messaging", color: "#00B900", basePrice: 0.8, successRate: 93, availableNumbers: 320, countryCount: 12 },
  { id: "kakaotalk", name: "KakaoTalk", category: "Messaging", color: "#FEE500", basePrice: 0.7, successRate: 94, availableNumbers: 280, countryCount: 11 },

  // Email
  { id: "gmail", name: "Gmail", category: "Email", color: "#EA4335", basePrice: 1.5, successRate: 96, availableNumbers: 580, countryCount: 18, popular: true },
  { id: "yahoo", name: "Yahoo", category: "Email", color: "#6001D2", basePrice: 1.2, successRate: 94, availableNumbers: 420, countryCount: 16 },
  { id: "outlook", name: "Outlook", category: "Email", color: "#0078D4", basePrice: 1.3, successRate: 93, availableNumbers: 390, countryCount: 16 },
  { id: "proton", name: "Proton Mail", category: "Email", color: "#8B5CF6", basePrice: 1.8, successRate: 91, availableNumbers: 210, countryCount: 14 },

  // Shopping
  { id: "amazon", name: "Amazon", category: "Shopping", color: "#FF9900", basePrice: 1.0, successRate: 97, availableNumbers: 680, countryCount: 17, popular: true },
  { id: "ebay", name: "eBay", category: "Shopping", color: "#E53238", basePrice: 0.9, successRate: 95, availableNumbers: 520, countryCount: 15 },
  { id: "alibaba", name: "Alibaba", category: "Shopping", color: "#FF6A00", basePrice: 0.8, successRate: 93, availableNumbers: 380, countryCount: 13 },
  { id: "temu", name: "Temu", category: "Shopping", color: "#FB6A14", basePrice: 0.6, successRate: 94, availableNumbers: 490, countryCount: 14 },
  { id: "aliexpress", name: "AliExpress", category: "Shopping", color: "#FF4747", basePrice: 0.7, successRate: 95, availableNumbers: 560, countryCount: 15 },

  // Entertainment
  { id: "netflix", name: "Netflix", category: "Entertainment", color: "#E50914", basePrice: 1.5, successRate: 96, availableNumbers: 420, countryCount: 17, popular: true },
  { id: "spotify", name: "Spotify", category: "Entertainment", color: "#1DB954", basePrice: 1.0, successRate: 97, availableNumbers: 580, countryCount: 18 },
  { id: "disney", name: "Disney+", category: "Entertainment", color: "#0063E5", basePrice: 1.2, successRate: 95, availableNumbers: 360, countryCount: 15 },
  { id: "prime", name: "Prime Video", category: "Entertainment", color: "#00A8E1", basePrice: 1.0, successRate: 96, availableNumbers: 410, countryCount: 16 },
  { id: "hulu", name: "Hulu", category: "Entertainment", color: "#1CE783", basePrice: 1.1, successRate: 94, availableNumbers: 280, countryCount: 12 },

  // Gaming
  { id: "steam", name: "Steam", category: "Gaming", color: "#1B2838", basePrice: 1.2, successRate: 95, availableNumbers: 490, countryCount: 17, popular: true },
  { id: "epic", name: "Epic Games", category: "Gaming", color: "#2F2F2F", basePrice: 1.0, successRate: 96, availableNumbers: 420, countryCount: 16 },
  { id: "playstation", name: "PlayStation", category: "Gaming", color: "#003791", basePrice: 1.5, successRate: 94, availableNumbers: 320, countryCount: 15 },
  { id: "xbox", name: "Xbox", category: "Gaming", color: "#107C10", basePrice: 1.4, successRate: 93, availableNumbers: 280, countryCount: 14 },
  { id: "riot", name: "Riot Games", category: "Gaming", color: "#D13639", basePrice: 0.8, successRate: 96, availableNumbers: 460, countryCount: 16 },
  { id: "pubg", name: "PUBG", category: "Gaming", color: "#F4D03F", basePrice: 0.7, successRate: 95, availableNumbers: 380, countryCount: 14 },
  { id: "freefire", name: "Free Fire", category: "Gaming", color: "#FF7A00", basePrice: 0.6, successRate: 96, availableNumbers: 520, countryCount: 15 },

  // Crypto & Finance
  { id: "binance", name: "Binance", category: "Crypto & Finance", color: "#F3BA2F", basePrice: 3.0, successRate: 97, availableNumbers: 280, countryCount: 14, popular: true },
  { id: "coinbase", name: "Coinbase", category: "Crypto & Finance", color: "#0052FF", basePrice: 3.5, successRate: 96, availableNumbers: 210, countryCount: 12 },
  { id: "bybit", name: "Bybit", category: "Crypto & Finance", color: "#F7A600", basePrice: 2.5, successRate: 95, availableNumbers: 240, countryCount: 13 },
  { id: "kucoin", name: "KuCoin", category: "Crypto & Finance", color: "#23AF91", basePrice: 2.0, successRate: 94, availableNumbers: 260, countryCount: 13 },
  { id: "kraken", name: "Kraken", category: "Crypto & Finance", color: "#5741D9", basePrice: 2.8, successRate: 95, availableNumbers: 180, countryCount: 11 },
];

export const CATEGORIES: ServiceCategory[] = [
  "Social Media",
  "Messaging",
  "Email",
  "Shopping",
  "Entertainment",
  "Gaming",
  "Crypto & Finance",
];

// Placeholder event catalog ported from the Claude Design export (Doorman.dc.html).
// TODO: replace with real data derived from useChainData().events + seatTiers once
// on-chain events carry display metadata (title/venue/date/category/hero art).
export interface MockEvent {
  title: string;
  category: string;
  date: string;
  venue: string;
  minPrice: number;
  hue: number;
  /** Optional path under app/public (e.g. "/events/foo.jpg"). Falls back to
   * the hue-based gradient (eventImageBackground) when omitted. */
  image?: string;
  /** Venue country, shown next to `venue` (e.g. "홍대 라이브클럽 데이 · 대한민국"). */
  countryKo: string;
  countryEn: string;
}

export const ALL_CATEGORY = "전체";

export const CATEGORIES = ["전체", "콘서트", "페스티벌", "뮤지컬/연극", "스포츠", "e스포츠", "팬미팅"];

export const CATEGORY_EN: Record<string, string> = {
  전체: "All",
  콘서트: "Concert",
  페스티벌: "Festival",
  "뮤지컬/연극": "Musical/Play",
  스포츠: "Sports",
  e스포츠: "Esports",
  팬미팅: "Fan meeting",
};

export const RAW_EVENTS: MockEvent[] = [
  { title: "[LaLiga 10R] FC Barcelona vs Real Madrid (for test)", category: "스포츠", date: "2026.10.25 (일) 04:00", venue: "Sportify Camp Nou", minPrice: 200, hue: 190, image: "/events/laliga.jpg", countryKo: "스페인", countryEn: "Spain" },
  { title: "[LoL World Championship Final] T1 vs BLG", category: "e스포츠", date: "2026.10.05 (월)", venue: "Busan Bexco", minPrice: 88, hue: 20, image: "/events/lol.png", countryKo: "대한민국", countryEn: "South Korea" },
  { title: "BLACKPINK WORLD TOUR [BORN PINK] EUROPE", category: "콘서트", date: "2026.11.21 (토) 18:30", venue: "Wembley Stadium", minPrice: 32, hue: 260, image: "/events/blackpink.png", countryKo: "영국", countryEn: "United Kingdom" },
  { title: "Chicago the Musical", category: "뮤지컬/연극", date: "2026.09.01 ~ 11.01", venue: "Ambassador Theatre", minPrice: 60, hue: 320, image: "/events/chicago.png", countryKo: "미국", countryEn: "United States" },
  { title: "Coachella Valley Music and Arts Festival", category: "페스티벌", date: "2027.04.09 ~ 04.18", venue: "Empire Polo Club, Indio, CA", minPrice: 25, hue: 45, image: "/events/coachella.png", countryKo: "미국", countryEn: "United States" },
];

// The prototype cycles the hero carousel through gradients only for these 3 events.
export const HERO_EVENT_MAP = [0, 1, 2];

export const HERO_GRADIENTS = [
  "radial-gradient(ellipse 1200px 700px at 20% 20%, rgba(30,201,183,0.2), transparent), linear-gradient(160deg, #1a2125 0%, #14191d 60%)",
  "radial-gradient(ellipse 1200px 700px at 80% 30%, rgba(59,130,246,0.18), transparent), linear-gradient(200deg, #1a2125 0%, #14191d 60%)",
  "radial-gradient(ellipse 1200px 700px at 50% 80%, rgba(30,201,183,0.16), transparent), linear-gradient(180deg, #1a2125 0%, #14191d 60%)",
];

export function eventImageBackground(hue: number): string {
  return `repeating-linear-gradient(135deg, hsl(${hue} 25% 16%) 0px, hsl(${hue} 25% 16%) 10px, hsl(${hue} 20% 20%) 10px, hsl(${hue} 20% 20%) 20px)`;
}

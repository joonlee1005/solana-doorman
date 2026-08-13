// Jurisdiction catalog for the event-creation form.
// TODO: replace with real data from useChainData().jurisdictions (accounts
// created via createJurisdictionRegistry()) once wired.
export interface MockJurisdiction {
  code: string;
  labelKo: string;
  labelEn: string;
  /** Matches on-chain legalCapBps: basis points, 10_000 = 100%. */
  capBps: number;
}

export const JURISDICTIONS: MockJurisdiction[] = [
  { code: "KOR", labelKo: "대한민국", labelEn: "South Korea", capBps: 2000 },
  { code: "USA", labelKo: "미국", labelEn: "United States", capBps: 1000 },
  { code: "JPN", labelKo: "일본", labelEn: "Japan", capBps: 0 },
];

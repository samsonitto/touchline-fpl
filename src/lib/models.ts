export interface Player {
  id: number;
  name: string;
  fullName: string;
  club: number;
  position: number;
  price: number;
  points: number;
  expectedPoints?: number | null;
  form: number;
  ownership: number;
  ppg: number;
  status: string;
  news: string;
}
export interface Club {
  id: number;
  name: string;
  short: string;
}
export interface Position {
  id: number;
  name: string;
  short: string;
  count: number;
  min: number;
  max: number;
}
export interface Gameweek {
  id: number;
  name: string;
  deadline: string;
  current: boolean;
  finished: boolean;
}
export interface Fixture {
  id: number;
  event: number | null;
  home: number;
  away: number;
  kickoff: string | null;
  finished: boolean;
  homeDifficulty: number;
  awayDifficulty: number;
}
export interface Catalog {
  projectionGameweek?: number | null;
  players: Player[];
  clubs: Club[];
  positions: Position[];
  gameweeks: Gameweek[];
  fixtures: Fixture[];
  rules: { size: number; starters: number; clubLimit: number; budget: number };
  updated: string;
}
export interface Pick {
  player: number;
  starter: boolean;
}
export interface Draft {
  transfers?: {
    base: number[];
    bank: number;
    free: number | null;
    prices: Record<string, { purchase?: number; selling?: number }>;
  };
  chip?: "triple-captain" | "bench-boost" | null;
  id: string;
  name: string;
  picks: Pick[];
  captain: number | null;
  vice: number | null;
  budget: number;
  imported?: { entry: number; gameweek: number; team: string; manager: string };
  updated: string;
}
export interface SavedState {
  version: 1;
  drafts: Draft[];
  active: string;
  baseline: string | null;
  entry: string;
  preferences: { sort: string; position: number };
}
export const money = (value: number) => `£${(value / 10).toFixed(1)}m`;
export const emptyDraft = (budget = 1000): Draft => ({
  id: crypto.randomUUID(),
  name: "My first plan",
  picks: [],
  captain: null,
  vice: null,
  budget,
  updated: new Date().toISOString(),
});

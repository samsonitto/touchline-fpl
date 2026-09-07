import { describe, it, expect } from "vitest";
import { Catalog, Draft, money } from "./models";
import {
  addIssue,
  compare,
  cost,
  extractEntry,
  formation,
  validate,
} from "./squad";
import { mapCatalog, mapImport } from "./fpl";
import { canSubstitute, substitute } from "./substitutions";
const positions = [
  { id: 1, name: "Goalkeeper", short: "GKP", count: 2, min: 1, max: 1 },
  { id: 2, name: "Defender", short: "DEF", count: 5, min: 3, max: 5 },
  { id: 3, name: "Midfielder", short: "MID", count: 5, min: 2, max: 5 },
  { id: 4, name: "Forward", short: "FWD", count: 3, min: 1, max: 3 },
];
export const catalog: Catalog = {
  players: Array.from({ length: 16 }, (_, i) => ({
    id: i + 1,
    name: `Player ${i + 1}`,
    fullName: `Player ${i + 1}`,
    club: (i % 6) + 1,
    position: i < 2 ? 1 : i < 7 ? 2 : i < 12 ? 3 : 4,
    price: 50,
    points: i * 10,
    form: 2,
    ownership: 5,
    ppg: 3,
    status: "a",
    news: "",
  })),
  clubs: Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    name: `Club ${i + 1}`,
    short: `C${i + 1}`,
  })),
  positions,
  gameweeks: [],
  fixtures: [],
  rules: { size: 15, starters: 11, clubLimit: 3, budget: 1000 },
  updated: "2026-01-01",
};
const starters = [1, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14];
const draft: Draft = {
  id: "test",
  name: "Test",
  picks: catalog.players
    .slice(0, 15)
    .map((p) => ({ player: p.id, starter: starters.includes(p.id) })),
  captain: 13,
  vice: 14,
  budget: 1000,
  updated: "2026-01-01",
};
describe("quick substitutions", () => {
  it("allows either player to initiate a legal formation change", () => {
    expect(canSubstitute(draft, 3, 12, catalog)).toBe(true);
    expect(substitute(draft, 3, 12, catalog)).toEqual(
      substitute(draft, 12, 3, catalog),
    );
    expect(validate(substitute(draft, 3, 12, catalog), catalog)).toEqual([]);
  });
  it("only swaps goalkeepers with goalkeepers", () => {
    expect(canSubstitute(draft, 1, 2, catalog)).toBe(true);
    expect(canSubstitute(draft, 1, 7, catalog)).toBe(false);
    expect(canSubstitute(draft, 3, 2, catalog)).toBe(false);
  });
  it("rejects swaps that break formation limits", () => {
    const threeDefenders = substitute(draft, 3, 12, catalog);
    expect(canSubstitute(threeDefenders, 4, 15, catalog)).toBe(false);
    const fiveDefenders = substitute(draft, 8, 7, catalog);
    expect(validate(fiveDefenders, catalog)).toEqual([]);
  });
  it("preserves squad size and the other bench slots", () => {
    const changed = substitute(draft, 3, 12, catalog);
    expect(changed.picks.filter((p) => p.starter)).toHaveLength(11);
    expect(new Set(changed.picks.map((p) => p.player)).size).toBe(15);
    expect(
      changed.picks.filter((p) => !p.starter).map((p) => p.player),
    ).toEqual([2, 7, 3, 15]);
    expect(draft.picks.find((p) => p.player === 3)?.starter).toBe(true);
  });
  it("hands captain and vice captain to their incoming replacement", () => {
    expect(substitute(draft, 13, 15, catalog).captain).toBe(15);
    const changed = substitute(draft, 15, 14, catalog);
    expect(changed.vice).toBe(15);
    expect(validate(changed, catalog)).toEqual([]);
  });
  it("leaves invalid and same-side selections untouched", () => {
    for (const [a, b] of [
      [1, 7],
      [3, 4],
      [7, 12],
      [3, 999],
      [3, 3],
    ]) {
      expect(substitute(draft, a, b, catalog)).toBe(draft);
    }
  });
});
describe("squad rules", () => {
  it("accepts a complete valid 4-4-2 squad", () => {
    expect(validate(draft, catalog)).toEqual([]);
    expect(formation(draft, catalog)).toBe("4–4–2");
  });
  it("checks size and positional quotas", () => {
    expect(
      validate({ ...draft, picks: draft.picks.slice(2) }, catalog).join(" "),
    ).toMatch(/15 players.*2 goalkeepers/);
  });
  it("checks maximum three per club", () => {
    const c = {
      ...catalog,
      players: catalog.players.map((p) => ({ ...p, club: 1 })),
    };
    expect(validate(draft, c).join(" ")).toContain("Maximum 3");
    expect(
      addIssue({ ...draft, picks: draft.picks.slice(0, 3) }, c.players[4], c),
    ).toBe("Club limit reached");
  });
  it("uses integer tenths and checks budget", () => {
    expect(money(55)).toBe("£5.5m");
    expect(cost(draft, catalog)).toBe(750);
    expect(validate({ ...draft, budget: 749 }, catalog)).toContain(
      "Squad exceeds the planning budget.",
    );
  });
  it("rejects invalid starting formations", () => {
    const d = {
      ...draft,
      picks: draft.picks.map((p) => ({ ...p, starter: p.player <= 11 })),
    };
    expect(validate(d, catalog).join(" ")).toContain("Start 1 goalkeeper");
    expect(validate(d, catalog).join(" ")).toContain("Start 1–3 forwards");
  });
  it("requires distinct starting captains", () => {
    expect(validate({ ...draft, vice: 13 }, catalog)).toContain(
      "Captain and vice-captain must be different.",
    );
    expect(validate({ ...draft, captain: 2 }, catalog)).toContain(
      "Choose a starting captain.",
    );
  });
  it("calculates replacement affordability using outgoing price", () => {
    expect(
      addIssue({ ...draft, budget: 750 }, catalog.players[15], catalog, 15),
    ).toBeNull();
    expect(addIssue(draft, catalog.players[0], catalog)).toBe(
      "Already in your squad",
    );
  });
  it("compares planned additions, removals, costs and statistics", () => {
    const b = {
      ...draft,
      picks: draft.picks.map((p) =>
        p.player === 15 ? { ...p, player: 16 } : p,
      ),
    };
    const result = compare(draft, b, catalog);
    expect(result.added.map((p) => p.id)).toEqual([16]);
    expect(result.removed.map((p) => p.id)).toEqual([15]);
    expect(result.retained).toHaveLength(14);
    expect(result.money).toBe(0);
    expect(result.after.points - result.before.points).toBe(10);
  });
});
describe("entry IDs", () => {
  it.each([
    "1234567",
    " https://fantasy.premierleague.com/entry/1234567/event/4 ",
    "https://fantasy.premierleague.com/entry/1234567/",
  ])("accepts %s", (s) => expect(extractEntry(s)).toBe(1234567));
  it.each([
    "0",
    "-2",
    "1.5",
    "https://evil.com/entry/1",
    "https://fantasy.premierleague.com.evil.com/entry/1",
    "99999999999999999",
    "abc",
  ])("rejects %s", (s) => expect(extractEntry(s)).toBeNull());
});
describe("upstream mapping", () => {
  const entry = {
    id: 10,
    name: "Public squad",
    player_first_name: "Test",
    player_last_name: "Manager",
    current_event: 4,
  };
  const picks = {
    picks: [
      ...draft.picks.filter((p) => p.starter),
      ...draft.picks.filter((p) => !p.starter),
    ].map((p, i) => ({
      element: p.player,
      position: i + 1,
      is_captain: p.player === 13,
      is_vice_captain: p.player === 14,
    })),
    entry_history: { bank: 25, value: 750 },
  };
  it("transforms published picks and preserves lineup and bank", () => {
    const d = mapImport(entry, picks, 4, catalog);
    expect(d.picks.filter((p) => p.starter)).toHaveLength(11);
    expect(d.captain).toBe(13);
    expect(d.budget).toBe(775);
    expect(d.imported?.gameweek).toBe(4);
  });
  it("rejects malformed bootstrap and import data", () => {
    expect(() => mapCatalog({}, [])).toThrow();
    expect(() => mapCatalog(null, null)).toThrow();
    expect(() => mapImport(entry, { picks: [] }, 4, catalog)).toThrow();
    expect(() =>
      mapImport(
        entry,
        { ...picks, picks: picks.picks.map((p) => ({ ...p, element: 999 })) },
        4,
        catalog,
      ),
    ).toThrow();
  });
});

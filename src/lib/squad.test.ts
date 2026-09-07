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
import { squadProjection, formatXpts, projectedTotal } from "./projections";
import { bootstrapSchema } from "./fpl";
import { encodeShare, decodeShare } from "./sharing";
import { canSubstitute, substitute } from "./substitutions";
import { sellingPrice, transferSummary, moveBench } from "./transfers";
import { emptyHistory, recordEdit, travel } from "./edit-history";
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
  it("applies half-profit rounding, losses, and explicit selling overrides", () => {
    expect(sellingPrice(57, 55)).toBe(56);
    expect(sellingPrice(58, 55)).toBe(56);
    expect(sellingPrice(52, 55)).toBe(52);
    expect(sellingPrice(57, 55, 54)).toBe(54);
    expect(sellingPrice(57)).toBe(57);
  });
  it("calculates net planned transfers and applies selling prices to affordability", () => {
    const d: Draft = {
      ...draft,
      transfers: {
        base: draft.picks.map((p) => p.player),
        bank: 0,
        free: 0,
        prices: { 13: { selling: 49 } },
      },
    };
    expect(addIssue(d, catalog.players[15], catalog, 13)).toBe("Over budget");
    const next = {
      ...d,
      picks: d.picks.map((p) => (p.player === 13 ? { ...p, player: 16 } : p)),
    };
    expect(transferSummary(next, catalog)).toMatchObject({
      bank: -1,
      incoming: [16],
      outgoing: [13],
      hits: 4,
      estimated: [],
    });
    expect(
      transferSummary(
        { ...next, transfers: { ...d.transfers!, free: 1 } },
        catalog,
      ).hits,
    ).toBe(0);
    expect(
      transferSummary(
        { ...next, transfers: { ...d.transfers!, free: null } },
        catalog,
      ).hits,
    ).toBeNull();
    expect(transferSummary(d, catalog)).toMatchObject({
      bank: 0,
      incoming: [],
      outgoing: [],
      hits: 0,
    });
    expect(
      transferSummary(
        { ...next, transfers: { ...d.transfers!, prices: {} } },
        catalog,
      ).estimated,
    ).toEqual([13]);
  });
  it("reorders outfield bench without changing goalkeeper, lineup, or captaincy", () => {
    const next = moveBench(draft, catalog, 12, -1);
    expect(next.picks.filter((p) => !p.starter).map((p) => p.player)).toEqual([
      2, 12, 7, 15,
    ]);
    expect(next.picks.filter((p) => p.starter)).toEqual(
      draft.picks.filter((p) => p.starter),
    );
    expect(next.captain).toBe(draft.captain);
    expect(moveBench(draft, catalog, 2, 1)).toBe(draft);
    expect(moveBench(draft, catalog, 7, -1)).toBe(draft);
  });
  it("undoes and redoes complete draft changes and clears redo after new edits", () => {
    const next = {
      ...draft,
      captain: 14,
      vice: 13,
      chip: "triple-captain" as const,
    };
    const h = recordEdit(emptyHistory(), draft);
    const undone = travel(h, next, "undo")!;
    expect(undone.draft).toMatchObject({ captain: 13, vice: 14 });
    expect(travel(undone.history, undone.draft, "redo")!.draft).toMatchObject({
      captain: 14,
      vice: 13,
      chip: "triple-captain",
    });
    expect(recordEdit(undone.history, undone.draft).future).toEqual([]);
    expect(travel(emptyHistory(), draft, "undo")).toBeNull();
    let bounded = emptyHistory();
    for (let i = 0; i < 60; i++) bounded = recordEdit(bounded, draft);
    expect(bounded.past).toHaveLength(50);
  });
  it("shares a Unicode snapshot with roles, order and chip but no manager identity", () => {
    const c = {
      ...catalog,
      gameweeks: [
        {
          id: 1,
          name: "GW1",
          deadline: "2026-08-21T18:00:00Z",
          current: true,
          finished: false,
        },
      ],
    };
    const source: Draft = {
      ...draft,
      name: "José ⚽ plan",
      chip: "bench-boost",
      imported: {
        entry: 123,
        gameweek: 1,
        team: "Private",
        manager: "Secret manager",
      },
    };
    const token = encodeShare(source, c);
    const copy = decodeShare(token, c);
    expect(copy).toMatchObject({
      name: source.name,
      picks: source.picks,
      captain: source.captain,
      vice: source.vice,
      chip: source.chip,
      budget: source.budget,
    });
    expect(copy.id).not.toBe(source.id);
    expect(copy.imported).toBeUndefined();
    expect(atob(token.replaceAll("-", "+").replaceAll("_", "/"))).not.toContain(
      "Secret manager",
    );
    expect(
      decodeShare(
        encodeShare(
          { ...draft, picks: draft.picks.slice(0, 1), captain: 1, vice: null },
          c,
        ),
        c,
      ).picks,
    ).toHaveLength(1);
    expect(() =>
      decodeShare(token, {
        ...c,
        gameweeks: [{ ...c.gameweeks[0], deadline: "2027-08-21T18:00:00Z" }],
      }),
    ).toThrow(/season/);
    expect(() => decodeShare(token, { ...c, players: [] })).toThrow(
      /unavailable/,
    );
    expect(() =>
      decodeShare(
        encodeShare({ ...draft, picks: [draft.picks[0], draft.picks[0]] }, c),
        c,
      ),
    ).toThrow(/duplicate/);
    expect(() =>
      decodeShare(encodeShare({ ...draft, captain: 2 }, c), c),
    ).toThrow(/captain/);
    for (const bad of ["", "bad%", "a".repeat(6001), btoa("{}")])
      expect(() => decodeShare(bad, c)).toThrow();
  });
  it("totals projections with captain doubled and bench separate", () => {
    const c = {
      ...catalog,
      projectionGameweek: 4,
      players: catalog.players.map((p) => ({ ...p, expectedPoints: 2.5 })),
    };
    expect(squadProjection(draft, c)).toEqual({ starters: 30, bench: 10 });
    const triple: Draft = { ...draft, chip: "triple-captain" };
    expect(projectedTotal(triple, squadProjection(triple, c))).toBe(32.5);
    const boost: Draft = { ...draft, chip: "bench-boost" };
    expect(projectedTotal(boost, squadProjection(boost, c))).toBe(40);
    expect(projectedTotal(boost, { starters: 30, bench: null })).toBeNull();
    expect(projectedTotal(draft, { starters: 30, bench: null })).toBe(30);
    expect(squadProjection({ ...triple, captain: 2 }, c).starters).toBe(27.5);
    expect(squadProjection({ ...draft, captain: 2 }, c).starters).toBe(27.5);
    expect(squadProjection({ ...draft, picks: [] }, c)).toEqual({
      starters: null,
      bench: null,
    });
    expect(
      squadProjection(draft, { ...c, projectionGameweek: null }).starters,
    ).toBeNull();
  });
  it("keeps zero projections and reports missing values without partial totals", () => {
    const c = {
      ...catalog,
      projectionGameweek: 4,
      players: catalog.players.map((p) => ({
        ...p,
        expectedPoints: 0 as number | null,
      })),
    };
    expect(squadProjection(draft, c)).toEqual({ starters: 0, bench: 0 });
    c.players[0].expectedPoints = null;
    expect(squadProjection(draft, c)).toEqual({ starters: null, bench: 0 });
    expect(formatXpts(0)).toBe("0.0");
    expect(formatXpts(null)).toBe("—");
  });
  it("maps FPL projections and the explicit next gameweek without fixture multipliers", () => {
    const raw = {
      elements: [
        {
          id: 1,
          web_name: "Test",
          first_name: "Test",
          second_name: "Player",
          team: 1,
          element_type: 1,
          now_cost: 50,
          total_points: 5,
          ep_next: "8.5",
          form: "2.0",
          selected_by_percent: "1.0",
          points_per_game: "2.0",
          status: "a",
          news: "",
        },
      ],
      teams: [{ id: 1, name: "Club", short_name: "CLU" }],
      element_types: positions.map((p) => ({
        id: p.id,
        singular_name: p.name,
        singular_name_short: p.short,
        squad_select: p.count,
        squad_min_play: p.min,
        squad_max_play: p.max,
      })),
      events: [
        {
          id: 4,
          name: "Gameweek 4",
          deadline_time: "2026-09-12T12:30:00Z",
          is_current: false,
          is_next: true,
          finished: false,
        },
      ],
    };
    const mapped = mapCatalog(raw, []);
    expect(mapped.projectionGameweek).toBe(4);
    expect(mapped.players[0].expectedPoints).toBe(8.5);
    for (const value of [null, undefined, "", "invalid"]) {
      expect(
        bootstrapSchema.parse({
          ...raw,
          elements: [{ ...raw.elements[0], ep_next: value }],
        }).elements[0].ep_next ?? null,
      ).toBeNull();
    }
  });
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

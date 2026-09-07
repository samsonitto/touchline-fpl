import type { Catalog, Draft } from "./models";
import { transferSummary } from "./transfers";
import { validate } from "./squad";

export function catalogForWeek(c: Catalog, week?: number): Catalog {
  if (!week) return c;
  return {
    ...c,
    projectionGameweek: c.projectionGameweek === week ? week : null,
    players:
      c.projectionGameweek === week
        ? c.players
        : c.players.map((p) => ({ ...p, expectedPoints: null })),
    fixtures: c.fixtures.filter((f) => f.event === null || f.event >= week),
  };
}
export function timelineStale(
  d: Draft,
  drafts: Draft[],
  visited = new Set<string>(),
): boolean {
  if (!d.timeline?.parent) return false;
  if (visited.has(d.id)) return true;
  visited.add(d.id);
  const parent = drafts.find((p) => p.id === d.timeline!.parent);
  return (
    !parent ||
    parent.updated !== d.timeline.source ||
    timelineStale(parent, drafts, visited)
  );
}
export function chipConflict(d: Draft, drafts: Draft[]): Draft | undefined {
  if (!d.chip || !d.timeline || !d.gameweek) return;
  return drafts.find(
    (p) =>
      p.id !== d.id &&
      p.timeline?.series === d.timeline!.series &&
      p.chip === d.chip &&
      p.gameweek &&
      p.gameweek <= 19 === d.gameweek! <= 19,
  );
}
export function nextWeek(d: Draft, c: Catalog): Draft {
  const week = d.gameweek ?? c.projectionGameweek;
  if (!week || !c.gameweeks.some((w) => w.id === week + 1))
    throw new Error("No later gameweek is available in this season.");
  if (validate(d, c).length)
    throw new Error("Complete a valid squad before carrying it forward.");
  if (!d.transfers)
    throw new Error(
      "Set up transfer planning and check your bank before carrying it forward.",
    );
  const summary = transferSummary(d, c);
  const prices: NonNullable<Draft["transfers"]>["prices"] = {};
  for (const pick of d.picks) {
    prices[pick.player] = d.transfers.base.includes(pick.player)
      ? { ...d.transfers.prices[pick.player] }
      : { purchase: c.players.find((p) => p.id === pick.player)!.price };
  }
  return {
    ...d,
    id: crypto.randomUUID(),
    name: `${d.name.replace(/ · GW\d+$/, "")} · GW${week + 1}`,
    gameweek: week + 1,
    timeline: {
      series: d.timeline?.series ?? d.id,
      parent: d.id,
      source: d.updated,
    },
    picks: d.picks.map((p) => ({ ...p })),
    chip: null,
    transfers: {
      base: d.picks.map((p) => p.player),
      bank: summary.bank,
      free:
        d.transfers.free === null
          ? null
          : Math.min(
              5,
              Math.max(0, d.transfers.free - summary.incoming.length) + 1,
            ),
      prices,
    },
    updated: new Date().toISOString(),
  };
}

import type { Catalog, Draft } from "./models";

export const formatXpts = (value: number | null | undefined) =>
  value == null ? "—" : value.toFixed(1);

export function projectedTotal(
  draft: Draft,
  projection: { starters: number | null; bench: number | null },
) {
  if (draft.chip !== "bench-boost") return projection.starters;
  return projection.starters == null || projection.bench == null
    ? null
    : projection.starters + projection.bench;
}

export function squadProjection(draft: Draft, catalog: Catalog) {
  function total(starter: boolean): number | null {
    const picks = draft.picks.filter((p) => p.starter === starter);
    if (
      !catalog.projectionGameweek ||
      (draft.gameweek && draft.gameweek !== catalog.projectionGameweek) ||
      !picks.length
    )
      return null;
    let sum = 0;
    for (const pick of picks) {
      const value = catalog.players.find(
        (p) => p.id === pick.player,
      )?.expectedPoints;
      if (value == null || !Number.isFinite(value)) return null;
      sum +=
        value *
        (starter && pick.player === draft.captain
          ? draft.chip === "triple-captain"
            ? 3
            : 2
          : 1);
    }
    return sum;
  }
  return { starters: total(true), bench: total(false) };
}

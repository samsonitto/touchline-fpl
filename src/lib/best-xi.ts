import type { Catalog, Draft } from "./models";
import { projectedTotal, squadProjection } from "./projections";

export function bestXI(
  d: Draft,
  c: Catalog,
): { draft: Draft; score: number; gain: number | null } {
  if (
    !c.projectionGameweek ||
    (d.gameweek && d.gameweek !== c.projectionGameweek)
  )
    throw new Error(
      "Best XI needs projections for the selected gameweek. FPL currently provides next-gameweek estimates only.",
    );
  const players = d.picks.map((p) => c.players.find((x) => x.id === p.player));
  if (
    d.picks.length !== 15 ||
    new Set(d.picks.map((p) => p.player)).size !== 15 ||
    players.some((p) => !p)
  )
    throw new Error(
      "Select 15 distinct available players before requesting a best XI.",
    );
  if (
    players.some(
      (p) => p!.expectedPoints == null || !Number.isFinite(p!.expectedPoints),
    )
  )
    throw new Error(
      "Some squad members have no projection. A reliable best XI cannot be calculated.",
    );
  if (
    c.positions.some(
      (pos) =>
        players.filter((p) => p!.position === pos.id).length !== pos.count,
    )
  )
    throw new Error(
      "Fix the squad's positional quotas before requesting a best XI.",
    );
  let best: Draft | null = null;
  let score = -Infinity;
  const currentSet = new Set(
    d.picks.filter((p) => p.starter).map((p) => p.player),
  );
  let bestChanges = Infinity;
  // There are only 1,365 possible starting elevens in a 15-player squad.
  for (let mask = 0; mask < 1 << 15; mask++) {
    const starters = players.filter((_, i) => mask & (1 << i));
    if (
      starters.length !== 11 ||
      c.positions.some((pos) => {
        const n = starters.filter((p) => p!.position === pos.id).length;
        return n < pos.min || n > pos.max;
      })
    )
      continue;
    const ranked = [...starters].sort(
      (a, b) =>
        b!.expectedPoints! - a!.expectedPoints! ||
        Number(b!.id === d.captain) - Number(a!.id === d.captain) ||
        a!.id - b!.id,
    );
    const ids = new Set(starters.map((p) => p!.id));
    const captain = ranked[0]!.id;
    const vice =
      ids.has(d.vice!) && d.vice !== captain ? d.vice : ranked[1]!.id;
    const candidate = {
      ...d,
      picks: d.picks.map((p) => ({ ...p, starter: ids.has(p.player) })),
      captain,
      vice,
    };
    const total = projectedTotal(candidate, squadProjection(candidate, c))!;
    const changes =
      starters.filter((p) => !currentSet.has(p!.id)).length +
      Number(captain !== d.captain);
    if (
      total > score + 1e-8 ||
      (Math.abs(total - score) < 1e-8 && changes < bestChanges)
    ) {
      best = candidate;
      score = total;
      bestChanges = changes;
    }
  }
  if (!best)
    throw new Error("No legal starting XI can be formed from this squad.");
  const current = projectedTotal(d, squadProjection(d, c));
  return {
    draft: best,
    score,
    gain: current === null ? null : score - current,
  };
}

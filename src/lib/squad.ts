import { Catalog, Draft, Player } from "./models";
import { transferSummary } from "./transfers";
export function playersIn(d: Draft, c: Catalog): Player[] {
  return d.picks.flatMap((p) => {
    const player = c.players.find((x) => x.id === p.player);
    return player ? [player] : [];
  });
}
export function cost(d: Draft, c: Catalog) {
  return playersIn(d, c).reduce((a, p) => a + p.price, 0);
}
export function formation(d: Draft, c: Catalog) {
  return [2, 3, 4]
    .map(
      (pos) =>
        d.picks.filter(
          (p) =>
            p.starter &&
            c.players.find((x) => x.id === p.player)?.position === pos,
        ).length,
    )
    .join("–");
}
export function validate(d: Draft, c: Catalog): string[] {
  const issues: string[] = [];
  const ps = playersIn(d, c);
  const xi = ps.filter((p) => d.picks.find((x) => x.player === p.id)?.starter);
  if (d.picks.length !== c.rules.size)
    issues.push(`Select ${c.rules.size} players (${d.picks.length} selected).`);
  if (new Set(d.picks.map((p) => p.player)).size !== d.picks.length)
    issues.push("Each player can only appear once.");
  if (ps.length !== d.picks.length)
    issues.push(
      "A saved player is no longer in the current FPL feed. Remove them to continue.",
    );
  for (const pos of c.positions) {
    if (ps.filter((p) => p.position === pos.id).length !== pos.count)
      issues.push(`Select ${pos.count} ${pos.name.toLowerCase()}s.`);
    const n = xi.filter((p) => p.position === pos.id).length;
    if (n < pos.min || n > pos.max)
      issues.push(
        `Start ${pos.min === pos.max ? pos.min : `${pos.min}–${pos.max}`} ${pos.name.toLowerCase()}s.`,
      );
  }
  for (const club of c.clubs)
    if (ps.filter((p) => p.club === club.id).length > c.rules.clubLimit)
      issues.push(`Maximum ${c.rules.clubLimit} players from ${club.name}.`);
  if (transferSummary(d, c).bank < 0)
    issues.push("Squad exceeds the planning budget.");
  if (xi.length !== c.rules.starters)
    issues.push(`Select ${c.rules.starters} starters (${xi.length} selected).`);
  if (!xi.some((p) => p.id === d.captain))
    issues.push("Choose a starting captain.");
  if (!xi.some((p) => p.id === d.vice))
    issues.push("Choose a starting vice-captain.");
  if (d.captain !== null && d.captain === d.vice)
    issues.push("Captain and vice-captain must be different.");
  return issues;
}
export function addIssue(
  d: Draft,
  p: Player,
  c: Catalog,
  replace?: number,
): string | null {
  const ps = playersIn(d, c).filter((x) => x.id !== replace);
  if (ps.some((x) => x.id === p.id)) return "Already in your squad";
  if (ps.length >= c.rules.size)
    return "Squad full — select a player to replace";
  if (
    ps.filter((x) => x.position === p.position).length >=
    (c.positions.find((x) => x.id === p.position)?.count ?? 0)
  )
    return "Position quota full";
  if (ps.filter((x) => x.club === p.club).length >= c.rules.clubLimit)
    return "Club limit reached";
  if (
    transferSummary(
      {
        ...d,
        picks: [
          ...d.picks.filter((x) => x.player !== replace),
          { player: p.id, starter: false },
        ],
      },
      c,
    ).bank < 0
  )
    return "Over budget";
  return null;
}
export function extractEntry(input: string): number | null {
  let id = input.trim();
  if (!/^\d+$/.test(id)) {
    try {
      const u = new URL(id);
      if (u.hostname !== "fantasy.premierleague.com" || u.protocol !== "https:")
        return null;
      id = u.pathname.match(/^\/entry\/(\d+)(?:\/event\/\d+)?\/?$/)?.[1] ?? "";
    } catch {
      return null;
    }
  }
  const n = Number(id);
  return /^\d+$/.test(id) && Number.isSafeInteger(n) && n > 0 && n <= 2147483647
    ? n
    : null;
}
export function compare(a: Draft, b: Draft, c: Catalog) {
  const ap = playersIn(a, c),
    bp = playersIn(b, c);
  const sums = (ps: Player[]) => ({
    points: ps.reduce((s, p) => s + p.points, 0),
    form: ps.reduce((s, p) => s + p.form, 0),
  });
  return {
    retained: bp.filter((p) => ap.some((x) => x.id === p.id)),
    removed: ap.filter((p) => !bp.some((x) => x.id === p.id)),
    added: bp.filter((p) => !ap.some((x) => x.id === p.id)),
    money: cost(b, c) - cost(a, c),
    before: sums(ap),
    after: sums(bp),
    formationBefore: formation(a, c),
    formationAfter: formation(b, c),
  };
}
export function upcoming(p: Player, c: Catalog) {
  return c.fixtures
    .filter((f) => !f.finished && (f.home === p.club || f.away === p.club))
    .sort(
      (a, b) =>
        (a.event ?? 99) - (b.event ?? 99) ||
        (a.kickoff ?? "z").localeCompare(b.kickoff ?? "z"),
    )
    .slice(0, 3)
    .map((f) => ({
      id: f.id,
      event: f.event,
      opponent:
        c.clubs.find((x) => x.id === (f.home === p.club ? f.away : f.home))
          ?.short ?? "TBC",
      home: f.home === p.club,
      difficulty: f.home === p.club ? f.homeDifficulty : f.awayDifficulty,
    }));
}

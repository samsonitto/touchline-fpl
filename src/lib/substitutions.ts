import type { Catalog, Draft } from "./models";

/** A quick sub exchanges a starter and a substitute without breaking formation rules. */
export function canSubstitute(
  draft: Draft,
  first: number,
  second: number,
  catalog: Catalog,
): boolean {
  const a = draft.picks.find((p) => p.player === first);
  const b = draft.picks.find((p) => p.player === second);
  if (!a || !b || a.starter === b.starter) return false;
  const outgoing = a.starter ? first : second;
  const incoming = a.starter ? second : first;
  const outPlayer = catalog.players.find((p) => p.id === outgoing);
  const inPlayer = catalog.players.find((p) => p.id === incoming);
  if (
    !outPlayer ||
    !inPlayer ||
    (outPlayer.position === 1) !== (inPlayer.position === 1)
  )
    return false;
  const starters = draft.picks
    .filter((p) => p.starter)
    .map((p) =>
      catalog.players.find(
        (player) => player.id === (p.player === outgoing ? incoming : p.player),
      ),
    );
  if (starters.some((p) => !p)) return false;
  return catalog.positions.every((position) => {
    const count = starters.filter((p) => p?.position === position.id).length;
    return count >= position.min && count <= position.max;
  });
}

export function substitute(
  draft: Draft,
  first: number,
  second: number,
  catalog: Catalog,
): Draft {
  if (!canSubstitute(draft, first, second, catalog)) return draft;
  const outgoing = draft.picks.find((p) => p.player === first)!.starter
    ? first
    : second;
  const incoming = outgoing === first ? second : first;
  return {
    ...draft,
    // Exchange slot occupants to preserve the other substitutes' priority.
    picks: draft.picks.map((p) => ({
      ...p,
      player:
        p.player === outgoing
          ? incoming
          : p.player === incoming
            ? outgoing
            : p.player,
    })),
    captain: draft.captain === outgoing ? incoming : draft.captain,
    vice: draft.vice === outgoing ? incoming : draft.vice,
  };
}

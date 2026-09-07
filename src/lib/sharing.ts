import { z } from "zod";
import { emptyDraft, type Catalog, type Draft } from "./models";

const schema = z.object({
  v: z.literal(1),
  season: z.string().max(40),
  name: z.string().trim().min(1).max(100),
  picks: z
    .array(
      z.object({ player: z.number().int().positive(), starter: z.boolean() }),
    )
    .min(1)
    .max(15),
  captain: z.number().int().positive().nullable(),
  vice: z.number().int().positive().nullable(),
  chip: z.enum(["triple-captain", "bench-boost"]).nullable(),
  budget: z.number().int().min(0).max(100000),
});
function season(catalog: Catalog) {
  const first = [...catalog.gameweeks].sort((a, b) => a.id - b.id)[0];
  if (!first) throw new Error("Season data is unavailable. Try again shortly.");
  return first.deadline;
}
export function encodeShare(draft: Draft, catalog: Catalog): string {
  const payload = schema.parse({
    v: 1,
    season: season(catalog),
    name: draft.name.slice(0, 100),
    picks: draft.picks,
    captain: draft.captain,
    vice: draft.vice,
    chip: draft.chip ?? null,
    budget: draft.budget,
  });
  return btoa(
    Array.from(new TextEncoder().encode(JSON.stringify(payload)), (b) =>
      String.fromCharCode(b),
    ).join(""),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
export function decodeShare(token: string, catalog: Catalog): Draft {
  if (token.length > 6000 || !/^[A-Za-z0-9_-]+$/.test(token))
    throw new Error("This squad link is invalid or incomplete.");
  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(
      JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          Uint8Array.from(
            atob(token.replaceAll("-", "+").replaceAll("_", "/")),
            (c) => c.charCodeAt(0),
          ),
        ),
      ),
    );
  } catch {
    throw new Error("This squad link is invalid or incomplete.");
  }
  if (payload.season !== season(catalog))
    throw new Error("This squad link belongs to a different FPL season.");
  const ids = payload.picks.map((p) => p.player);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !catalog.players.some((p) => p.id === id))
  )
    throw new Error("This squad contains duplicate or unavailable players.");
  if (
    [payload.captain, payload.vice].some(
      (id) =>
        id !== null && !payload.picks.some((p) => p.player === id && p.starter),
    ) ||
    (payload.captain !== null && payload.captain === payload.vice)
  )
    throw new Error("This squad link has invalid captain selections.");
  return {
    ...emptyDraft(payload.budget),
    name: payload.name,
    picks: payload.picks,
    captain: payload.captain,
    vice: payload.vice,
    chip: payload.chip,
  };
}

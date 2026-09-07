import "server-only";
import { unstable_cache } from "next/cache";
import { entrySchema, mapCatalog, mapImport, summarySchema } from "./fpl";
type Endpoint =
  | "bootstrap-static/"
  | "fixtures/"
  | `entry/${number}/`
  | `entry/${number}/event/${number}/picks/`
  | `element-summary/${number}/`;
export class UpstreamError extends Error {
  constructor(public status: number) {
    super("FPL is temporarily unavailable. Please try again shortly.");
  }
}
export class NoPublishedPicksError extends Error {}
export async function requestFpl(path: Endpoint, seconds = 300) {
  const response = await fetch(
    `https://fantasy.premierleague.com/api/${path}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "TouchlinePlanner/1.0 (public FPL squad planning)",
      },
      signal: AbortSignal.timeout(10000),
      // Bootstrap exceeds the serialized fetch-cache limit; cache the normalized catalog.
      ...(path === "bootstrap-static/"
        ? { cache: "no-store" as const }
        : { next: { revalidate: seconds } }),
    },
  );
  if (!response.ok) throw new UpstreamError(response.status);
  return response.json() as Promise<unknown>;
}
export const getCatalog = unstable_cache(
  async () => {
    const [b, f] = await Promise.all([
      requestFpl("bootstrap-static/"),
      requestFpl("fixtures/"),
    ]);
    return mapCatalog(b, f);
  },
  ["touchline-catalog-v2-xpts"],
  { revalidate: 300 },
);
export async function importTeam(id: number) {
  const [raw, c] = await Promise.all([
    requestFpl(`entry/${id}/`, 60),
    getCatalog(),
  ]);
  const e = entrySchema.parse(raw);
  const weeks = c.gameweeks
    .filter(
      (w) =>
        (w.finished || new Date(w.deadline).getTime() < Date.now()) &&
        w.id <= (e.current_event ?? 0),
    )
    .sort((a, b) => b.id - a.id);
  for (const w of weeks) {
    try {
      return mapImport(
        raw,
        await requestFpl(`entry/${id}/event/${w.id}/picks/`, 60),
        w.id,
        c,
      );
    } catch (error) {
      if (error instanceof UpstreamError && error.status === 404) continue;
      throw error;
    }
  }
  throw new NoPublishedPicksError(
    "No published picks are available for this entry yet.",
  );
}
export async function playerSummary(id: number) {
  const s = summarySchema.parse(await requestFpl(`element-summary/${id}/`));
  return {
    history: s.history.map((h) => ({
      gameweek: h.round,
      points: h.total_points,
      minutes: h.minutes,
    })),
  };
}
const requests = new Map<string, { count: number; until: number }>();
export function rateLimit(request: Request) {
  const key =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  if (requests.size > 5000)
    for (const [k, v] of requests) if (v.until < now) requests.delete(k);
  const v = requests.get(key);
  if (v && v.until > now) {
    v.count++;
    return v.count > 40;
  }
  requests.set(key, { count: 1, until: now + 60000 });
  return false;
}
export function failure(error: unknown) {
  if (error instanceof NoPublishedPicksError)
    return Response.json(
      {
        error:
          "No published picks are available for this entry yet. Try after a Gameweek deadline.",
      },
      { status: 404 },
    );
  if (error instanceof UpstreamError && [403, 404].includes(error.status))
    return Response.json(
      {
        error:
          "This public team could not be found or is not accessible. Check the entry ID.",
      },
      { status: 404 },
    );
  return Response.json(
    {
      error:
        "FPL data is unavailable or its response has changed. Please try again shortly.",
    },
    { status: 503 },
  );
}

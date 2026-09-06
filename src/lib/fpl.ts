import { z } from "zod";
import { Catalog, Draft, Fixture } from "./models";
const integer = z.number().int();
const numeric = z
  .union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
  .transform(Number);
export const bootstrapSchema = z.object({
  elements: z
    .array(
      z.object({
        id: integer,
        web_name: z.string(),
        first_name: z.string(),
        second_name: z.string(),
        team: integer,
        element_type: integer,
        now_cost: integer.nonnegative(),
        total_points: integer,
        form: numeric,
        selected_by_percent: numeric,
        points_per_game: numeric,
        status: z.string(),
        news: z.string(),
      }),
    )
    .min(1),
  teams: z
    .array(z.object({ id: integer, name: z.string(), short_name: z.string() }))
    .min(1),
  element_types: z
    .array(
      z.object({
        id: integer,
        singular_name: z.string(),
        singular_name_short: z.string(),
        squad_select: integer.positive(),
        squad_min_play: integer,
        squad_max_play: integer,
      }),
    )
    .min(4),
  events: z.array(
    z.object({
      id: integer,
      name: z.string(),
      deadline_time: z.string(),
      is_current: z.boolean(),
      finished: z.boolean(),
    }),
  ),
  game_settings: z
    .object({
      squad_squadsize: integer.positive().default(15),
      squad_squadplay: integer.positive().default(11),
      squad_team_limit: integer.positive().default(3),
      squad_total_spend: integer.positive().default(1000),
    })
    .default({
      squad_squadsize: 15,
      squad_squadplay: 11,
      squad_team_limit: 3,
      squad_total_spend: 1000,
    }),
});
export const fixturesSchema = z.array(
  z.object({
    id: integer,
    event: integer.nullable(),
    team_h: integer,
    team_a: integer,
    kickoff_time: z.string().nullable(),
    finished: z.boolean(),
    team_h_difficulty: integer.min(1).max(5),
    team_a_difficulty: integer.min(1).max(5),
  }),
);
export function mapFixtures(raw: unknown): Fixture[] {
  return fixturesSchema.parse(raw).map((f) => ({
    id: f.id,
    event: f.event,
    home: f.team_h,
    away: f.team_a,
    kickoff: f.kickoff_time,
    finished: f.finished,
    homeDifficulty: f.team_h_difficulty,
    awayDifficulty: f.team_a_difficulty,
  }));
}
export function mapCatalog(raw: unknown, fixtures: unknown): Catalog {
  const b = bootstrapSchema.parse(raw);
  if (
    b.elements.some(
      (p) =>
        !b.teams.some((t) => t.id === p.team) ||
        !b.element_types.some((t) => t.id === p.element_type),
    )
  )
    throw new Error("Invalid player references");
  return {
    players: b.elements.map((p) => ({
      id: p.id,
      name: p.web_name,
      fullName: `${p.first_name} ${p.second_name}`,
      club: p.team,
      position: p.element_type,
      price: p.now_cost,
      points: p.total_points,
      form: p.form,
      ownership: p.selected_by_percent,
      ppg: p.points_per_game,
      status: p.status,
      news: p.news,
    })),
    clubs: b.teams.map((t) => ({
      id: t.id,
      name: t.name,
      short: t.short_name,
    })),
    positions: b.element_types.map((p) => ({
      id: p.id,
      name: p.singular_name,
      short: p.singular_name_short,
      count: p.squad_select,
      min: p.squad_min_play,
      max: p.squad_max_play,
    })),
    gameweeks: b.events.map((e) => ({
      id: e.id,
      name: e.name,
      deadline: e.deadline_time,
      current: e.is_current,
      finished: e.finished,
    })),
    fixtures: mapFixtures(fixtures),
    rules: {
      size: b.game_settings.squad_squadsize,
      starters: b.game_settings.squad_squadplay,
      clubLimit: b.game_settings.squad_team_limit,
      budget: b.game_settings.squad_total_spend,
    },
    updated: new Date().toISOString(),
  };
}
export const entrySchema = z.object({
  id: integer,
  name: z.string(),
  player_first_name: z.string(),
  player_last_name: z.string(),
  current_event: integer.nullable(),
});
export const picksSchema = z.object({
  picks: z
    .array(
      z.object({
        element: integer,
        position: integer.min(1).max(15),
        is_captain: z.boolean(),
        is_vice_captain: z.boolean(),
      }),
    )
    .length(15),
  entry_history: z.object({
    bank: integer.nonnegative(),
    value: integer.nonnegative(),
  }),
});
export function mapImport(
  entryRaw: unknown,
  picksRaw: unknown,
  gameweek: number,
  c: Catalog,
): Draft {
  const e = entrySchema.parse(entryRaw),
    r = picksSchema.parse(picksRaw);
  if (
    new Set(r.picks.map((p) => p.element)).size !== 15 ||
    new Set(r.picks.map((p) => p.position)).size !== 15 ||
    r.picks.some((p) => !c.players.some((x) => x.id === p.element)) ||
    r.picks.filter((p) => p.is_captain).length !== 1 ||
    r.picks.filter((p) => p.is_vice_captain).length !== 1
  )
    throw new Error("Invalid published picks");
  return {
    id: crypto.randomUUID(),
    name: `${e.name} · GW${gameweek}`,
    picks: r.picks
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ player: p.element, starter: p.position <= 11 })),
    captain: r.picks.find((p) => p.is_captain)!.element,
    vice: r.picks.find((p) => p.is_vice_captain)!.element,
    budget:
      r.picks.reduce(
        (s, p) => s + c.players.find((x) => x.id === p.element)!.price,
        0,
      ) + r.entry_history.bank,
    imported: {
      entry: e.id,
      gameweek,
      team: e.name,
      manager: `${e.player_first_name} ${e.player_last_name}`,
    },
    updated: new Date().toISOString(),
  };
}
export const summarySchema = z.object({
  history: z.array(
    z.object({ round: integer, total_points: integer, minutes: integer }),
  ),
  fixtures: z.array(
    z.object({
      event: integer.nullable(),
      is_home: z.boolean(),
      difficulty: integer,
      team_h: integer,
      team_a: integer,
    }),
  ),
});

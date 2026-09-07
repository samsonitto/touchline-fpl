import type { Catalog, Draft } from "./models";

export function sellingPrice(
  current: number,
  purchase?: number,
  override?: number,
) {
  if (override !== undefined) return override;
  return purchase === undefined
    ? current
    : Math.min(
        current,
        purchase + Math.floor(Math.max(0, current - purchase) / 2),
      );
}
export function transferSummary(d: Draft, c: Catalog) {
  const t = d.transfers;
  const current = d.picks.map((p) => p.player);
  const incoming = t ? current.filter((id) => !t.base.includes(id)) : [];
  const outgoing = t ? t.base.filter((id) => !current.includes(id)) : [];
  const price = (id: number) => c.players.find((p) => p.id === id)?.price ?? 0;
  const estimated = outgoing.filter(
    (id) =>
      t?.prices[id]?.purchase === undefined &&
      t?.prices[id]?.selling === undefined,
  );
  const bank = t
    ? t.bank +
      outgoing.reduce(
        (sum, id) =>
          sum +
          sellingPrice(
            price(id),
            t.prices[id]?.purchase,
            t.prices[id]?.selling,
          ),
        0,
      ) -
      incoming.reduce((sum, id) => sum + price(id), 0)
    : d.budget - d.picks.reduce((sum, p) => sum + price(p.player), 0);
  const hits = t
    ? t.free === null
      ? null
      : Math.max(0, incoming.length - t.free) * 4
    : 0;
  return { bank, incoming, outgoing, estimated, hits };
}
export function moveBench(
  d: Draft,
  c: Catalog,
  id: number,
  direction: -1 | 1,
): Draft {
  const indices = d.picks.flatMap((p, i) =>
    !p.starter && c.players.find((x) => x.id === p.player)?.position !== 1
      ? [i]
      : [],
  );
  const index = indices.findIndex((i) => d.picks[i].player === id);
  if (index < 0 || index + direction < 0 || index + direction >= indices.length)
    return d;
  const picks = [...d.picks];
  [picks[indices[index]], picks[indices[index + direction]]] = [
    picks[indices[index + direction]],
    picks[indices[index]],
  ];
  return { ...d, picks };
}

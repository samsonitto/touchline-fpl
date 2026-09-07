"use client";
import type { Catalog, Draft } from "@/lib/models";
import { money } from "@/lib/models";
import { sellingPrice, transferSummary } from "@/lib/transfers";
import { formatXpts, projectedTotal, squadProjection } from "@/lib/projections";

function PriceInput({
  value,
  onChange,
  label,
}: {
  value?: number;
  onChange: (value: number | undefined) => void;
  label: string;
}) {
  return (
    <input
      aria-label={label}
      type="number"
      min="0"
      max="100"
      step="0.1"
      placeholder="Unknown"
      defaultValue={value === undefined ? "" : (value / 10).toFixed(1)}
      key={String(value)}
      onBlur={(e) => {
        const raw = e.target.value;
        const number = Number(raw);
        if (raw === "") onChange(undefined);
        else if (
          Number.isFinite(number) &&
          number >= 0 &&
          number <= 100 &&
          Math.abs(number * 10 - Math.round(number * 10)) < 1e-6
        )
          onChange(Math.round(number * 10));
        else {
          e.target.value = value === undefined ? "" : (value / 10).toFixed(1);
        }
      }}
    />
  );
}
export default function TransferPlanning({
  draft,
  catalog,
  locked,
  update,
}: {
  draft: Draft;
  catalog: Catalog;
  locked: boolean;
  update: (fn: (draft: Draft) => Draft) => void;
}) {
  const t = draft.transfers;
  const summary = transferSummary(draft, catalog);
  const gross = projectedTotal(draft, squadProjection(draft, catalog));
  const name = (id: number) =>
    catalog.players.find((p) => p.id === id)?.name ??
    `Unavailable player ${id}`;
  return (
    <details className="transfer-planning">
      <summary>
        Transfer budget & points hits{" "}
        {t
          ? `· ${summary.incoming.length} planned · ${summary.hits === null ? "set free transfers" : `−${summary.hits} pts`}`
          : "· Set up"}
      </summary>
      {!t ? (
        <div>
          <p>
            Save your current 15 players as the starting squad. Transfers are
            counted as final squad changes, not every experiment. Set your
            current bank and remaining free transfers before planning.
          </p>
          <button
            disabled={
              locked ||
              draft.picks.length !== 15 ||
              new Set(draft.picks.map((p) => p.player)).size !== 15
            }
            onClick={() =>
              update((d) => ({
                ...d,
                transfers: {
                  base: d.picks.map((p) => p.player),
                  bank: Math.max(0, summary.bank),
                  free: null,
                  prices: {},
                },
              }))
            }
          >
            Start transfer planning
          </button>
          <small>
            A complete squad is required. Initial bank is an estimate from your
            planning budget; check it against FPL.
          </small>
        </div>
      ) : (
        <fieldset disabled={locked}>
          <div className="transfer-inputs">
            <label>
              Starting bank (£m)
              <PriceInput
                value={t.bank}
                label="Starting bank in millions"
                onChange={(bank) => {
                  if (bank !== undefined)
                    update((d) => ({
                      ...d,
                      transfers: { ...d.transfers!, bank },
                    }));
                }}
              />
            </label>
            <label>
              Free transfers remaining
              <select
                value={t.free ?? ""}
                onChange={(e) => {
                  const free =
                    e.target.value === "" ? null : Number(e.target.value);
                  update((d) => ({
                    ...d,
                    transfers: { ...d.transfers!, free },
                  }));
                }}
              >
                <option value="">Unknown — enter from FPL</option>
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p>
            Bank after moves: <strong>{money(summary.bank)}</strong> ·
            Transfers: <strong>{summary.incoming.length}</strong> · Hit:{" "}
            <strong>
              {summary.hits === null ? "Unknown" : `−${summary.hits} pts`}
            </strong>{" "}
            · Net xPts:{" "}
            <strong>
              {formatXpts(
                gross === null || summary.hits === null
                  ? null
                  : gross - summary.hits,
              )}
            </strong>
          </p>
          <p>
            Out: {summary.outgoing.map(name).join(", ") || "None"}
            <br />
            In: {summary.incoming.map(name).join(", ") || "None"}
          </p>
          <p>
            {summary.estimated.length
              ? `Estimated selling prices for: ${summary.estimated.map(name).join(", ")}.`
              : "Selling prices use your entries where provided."}{" "}
            Enter prices in £m and leave the field to save. Selling override
            takes priority over purchase price.
          </p>
          <div className="transfer-price-list">
            {t.base.map((id) => {
              const player = catalog.players.find((p) => p.id === id);
              const prices = t.prices[id] ?? {};
              const setPrice = (
                key: "purchase" | "selling",
                value: number | undefined,
              ) =>
                update((d) => ({
                  ...d,
                  transfers: {
                    ...d.transfers!,
                    prices: {
                      ...d.transfers!.prices,
                      [id]: { ...d.transfers!.prices[id], [key]: value },
                    },
                  },
                }));
              return (
                <div className="transfer-price-row" key={id}>
                  <strong>
                    {name(id)}
                    <small>
                      Market {player ? money(player.price) : "unavailable"} ·
                      Sell{" "}
                      {player
                        ? money(
                            sellingPrice(
                              player.price,
                              prices.purchase,
                              prices.selling,
                            ),
                          )
                        : "unavailable"}
                      {prices.purchase === undefined &&
                      prices.selling === undefined
                        ? " (estimate)"
                        : ""}
                    </small>
                  </strong>
                  <label>
                    Purchase (£m)
                    <PriceInput
                      value={prices.purchase}
                      label={`${name(id)} purchase price`}
                      onChange={(v) => setPrice("purchase", v)}
                    />
                  </label>
                  <label>
                    Selling (£m)
                    <PriceInput
                      value={prices.selling}
                      label={`${name(id)} selling price override`}
                      onChange={(v) => setPrice("selling", v)}
                    />
                  </label>
                </div>
              );
            })}
          </div>
          <p>
            One gameweek of planned moves. Previous transfers/hits, Wildcard and
            Free Hit are not simulated. Prices refresh with the feed; entered
            overrides stay fixed. Check bank and free transfers against your
            official team. Restore original players to cancel planned moves.
          </p>
          <button
            onClick={() =>
              update((d) => ({
                ...d,
                budget: Math.max(
                  0,
                  summary.bank +
                    d.picks.reduce(
                      (sum, p) =>
                        sum +
                        (catalog.players.find((x) => x.id === p.player)
                          ?.price ?? 0),
                      0,
                    ),
                ),
                transfers: undefined,
              }))
            }
          >
            Stop transfer planning
          </button>
        </fieldset>
      )}
    </details>
  );
}

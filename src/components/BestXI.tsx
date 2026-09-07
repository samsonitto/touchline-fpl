"use client";
import { useState } from "react";
import type { Catalog, Draft } from "@/lib/models";
import { bestXI } from "@/lib/best-xi";
import { formatXpts } from "@/lib/projections";
import { formation } from "@/lib/squad";

export default function BestXI({
  draft,
  catalog,
  locked,
  onApply,
}: {
  draft: Draft;
  catalog: Catalog;
  locked: boolean;
  onApply: (draft: Draft) => void;
}) {
  const [result, setResult] = useState<ReturnType<typeof bestXI> | null>(null);
  const [error, setError] = useState("");
  const name = (id: number | null) =>
    catalog.players.find((p) => p.id === id)?.name ?? "—";
  return (
    <section className="best-xi-panel" aria-label="Best XI suggestion">
      <div>
        <h2>Best XI suggestion</h2>
        <button
          disabled={locked || !catalog.projectionGameweek}
          onClick={() => {
            try {
              setResult(bestXI(draft, catalog));
              setError("");
            } catch (e) {
              setResult(null);
              setError((e as Error).message);
            }
          }}
        >
          Suggest XI & captain
        </button>
      </div>
      <small>
        {catalog.projectionGameweek
          ? `Uses FPL GW${catalog.projectionGameweek} estimates and legal formations. Includes the selected chip; no transfers or automatic substitutions.`
          : "No projections available for this week. Suggestions are unavailable."}
      </small>
      {error && <p role="status">{error}</p>}
      {result && (
        <div className="suggestion-review">
          <p>
            <strong>
              {formation(result.draft, catalog)} · {formatXpts(result.score)}{" "}
              xPts
            </strong>{" "}
            ·{" "}
            {result.gain === null
              ? "Current projection unavailable"
              : `${result.gain >= 0 ? "+" : ""}${formatXpts(result.gain)} vs current lineup`}
          </p>
          <p>
            Captain: <strong>{name(result.draft.captain)}</strong> ·
            Vice-captain: {name(result.draft.vice)}
          </p>
          <p>
            Start:{" "}
            {result.draft.picks
              .filter((p) => p.starter)
              .map((p) => name(p.player))
              .join(", ")}
          </p>
          <p>
            Bench:{" "}
            {result.draft.picks
              .filter((p) => !p.starter)
              .sort(
                (a, b) =>
                  Number(
                    catalog.players.find((p) => p.id === b.player)?.position ===
                      1,
                  ) -
                  Number(
                    catalog.players.find((p) => p.id === a.player)?.position ===
                      1,
                  ),
              )
              .map((p) => name(p.player))
              .join(", ")}
          </p>
          <small>
            Checks every legal XI in your squad. Highest projected total wins;
            ties favour fewer changes. Player availability is reflected only by
            FPL estimates; review injury news before applying.
          </small>
          <button
            className="primary"
            disabled={locked}
            onClick={() => onApply(result.draft)}
          >
            Apply suggested XI
          </button>
          <button onClick={() => setResult(null)}>Dismiss</button>
        </div>
      )}
    </section>
  );
}

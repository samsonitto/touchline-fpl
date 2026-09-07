"use client";
import type { Catalog, Draft } from "@/lib/models";
import { money } from "@/lib/models";
import { chipConflict, timelineStale } from "@/lib/timeline";
import { transferSummary } from "@/lib/transfers";

export default function Timeline({
  draft,
  catalog,
  drafts,
  locked,
  onStart,
  onNext,
  onSelect,
  onRefresh,
}: {
  draft: Draft;
  catalog: Catalog;
  drafts: Draft[];
  locked: boolean;
  onStart: () => void;
  onNext: () => void;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}) {
  const weeks = draft.timeline
    ? drafts
        .filter((d) => d.timeline?.series === draft.timeline!.series)
        .sort((a, b) => a.gameweek! - b.gameweek!)
    : [];
  const stale = timelineStale(draft, drafts);
  const conflict = chipConflict(draft, drafts);
  return (
    <section className="timeline-panel" aria-label="Gameweek timeline">
      <h2>Gameweek timeline</h2>
      {!draft.timeline ? (
        <>
          <p>
            Keep separate plans for each week, carrying bank, purchased players
            and free transfers forward.
          </p>
          <button
            disabled={locked || !catalog.projectionGameweek}
            onClick={onStart}
          >
            Start timeline at GW{catalog.projectionGameweek ?? "—"}
          </button>
        </>
      ) : (
        <>
          <div className="timeline-weeks">
            {weeks.map((d) => {
              const t = transferSummary(d, catalog);
              return (
                <button
                  key={d.id}
                  aria-pressed={draft.id === d.id}
                  onClick={() => onSelect(d.id)}
                >
                  <strong>GW{d.gameweek}</strong>
                  <span>
                    {t.incoming.length} moves · {money(t.bank)} bank
                  </span>
                  <span>
                    {d.transfers?.free ?? "?"} free ·{" "}
                    {d.chip === "triple-captain"
                      ? "TC"
                      : d.chip === "bench-boost"
                        ? "BB"
                        : "No chip"}
                  </span>
                  {timelineStale(d, drafts) && <span>Needs review</span>}
                </button>
              );
            })}
          </div>
          {stale && (
            <div role="status">
              <p>
                An earlier week changed or was deleted. This week’s snapshot is
                unchanged and needs review. Replacing it resets its planned
                moves and lineup; Undo can restore it.
              </p>
              <button
                disabled={
                  locked || !drafts.some((d) => d.id === draft.timeline?.parent)
                }
                onClick={onRefresh}
              >
                Replace this week from previous week
              </button>
            </div>
          )}
          {conflict && (
            <p role="status">
              Chip conflict with GW{conflict.gameweek}. Choose “No chip” in one
              of these weeks.
            </p>
          )}
          <button
            disabled={
              locked ||
              stale ||
              !!conflict ||
              !catalog.gameweeks.some((w) => w.id === draft.gameweek! + 1)
            }
            onClick={onNext}
          >
            Plan GW{(draft.gameweek ?? 0) + 1} →
          </button>
          <p>
            Carry forward requires a valid XI and transfer planning. Unused free
            transfers roll over, plus one, up to five. Unknown allowances stay
            unknown. Prices use today’s feed, not future price predictions.
          </p>
        </>
      )}
      <small>
        FPL xPts cover GW{catalog.projectionGameweek ?? "—"} only. Other weeks
        show fixtures and budgets without predictions. The timeline tracks
        Triple Captain and Bench Boost once per half (GW1–19 / GW20–38); check
        chips already used in your official team.
      </small>
    </section>
  );
}

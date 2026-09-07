"use client";
import { useEffect, useState } from "react";
import { Copy, Download, Share2 } from "lucide-react";
import type { Catalog, Draft } from "@/lib/models";
import { decodeShare, encodeShare } from "@/lib/sharing";
import { downloadSquadImage } from "@/lib/share-image";

export default function Sharing({
  draft,
  catalog,
  onCopy,
}: {
  draft: Draft;
  catalog: Catalog;
  onCopy: (draft: Draft) => void;
}) {
  const [incoming, setIncoming] = useState<Draft | null>(null);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const read = () => {
      if (!location.hash.startsWith("#squad=")) return;
      try {
        setIncoming(decodeShare(location.hash.slice(7), catalog));
      } catch (e) {
        setMessage((e as Error).message);
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [catalog]);
  function dismiss() {
    setIncoming(null);
    history.replaceState(null, "", location.pathname + location.search);
  }
  async function share() {
    try {
      const token = encodeShare(draft, catalog);
      // Validate the outgoing snapshot with the same rules recipients use.
      decodeShare(token, catalog);
      const url = `${location.origin}/#squad=${token}`;
      setLink(url);
      try {
        await navigator.clipboard.writeText(url);
        setMessage(
          "Squad link copied. Anyone with it can view and copy this snapshot.",
        );
      } catch {
        setMessage("Copy the squad link below to share your snapshot.");
      }
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function image() {
    setBusy(true);
    try {
      await downloadSquadImage(draft, catalog);
      setMessage("Squad image ready to download.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sharing-panel" aria-label="Share squad">
      {incoming && (
        <div className="shared-preview">
          <h2>Shared squad: {incoming.name}</h2>
          <p>
            Preview ·{" "}
            {incoming.chip === "triple-captain"
              ? "Triple Captain"
              : incoming.chip === "bench-boost"
                ? "Bench Boost"
                : "No chip"}{" "}
            · £{(incoming.budget / 10).toFixed(1)}m planning budget
          </p>
          {[true, false].map((starter) => (
            <div key={String(starter)}>
              <strong>{starter ? "Starting XI" : "Bench"}</strong>
              <p>
                {incoming.picks
                  .filter((p) => p.starter === starter)
                  .map(
                    (p) =>
                      `${catalog.players.find((player) => player.id === p.player)?.name}${p.player === incoming.captain ? " (C)" : p.player === incoming.vice ? " (VC)" : ""}`,
                  )
                  .join(" · ") || "No players"}
              </p>
            </div>
          ))}
          <p>
            Prices and xPts use current FPL data. Saving adds a new editable
            plan and keeps your existing drafts.
          </p>
          <button
            className="primary"
            onClick={() => {
              onCopy(incoming);
              dismiss();
              setMessage("Shared squad saved as your own editable copy.");
            }}
          >
            Save my copy
          </button>
          <button onClick={dismiss}>Dismiss</button>
        </div>
      )}
      <div className="share-actions">
        <span>
          <Share2 size={16} /> Share your plan
        </span>
        <button disabled={!draft.picks.length} onClick={() => void share()}>
          <Copy size={16} /> Copy squad link
        </button>
        <button
          disabled={!draft.picks.length || busy}
          onClick={() => void image()}
        >
          <Download size={16} />
          {busy ? "Creating image…" : "Download image"}
        </button>
      </div>
      <small>
        Snapshot sharing · Includes squad name, picks, captaincy, chip and
        budget. Manager details stay private.
      </small>
      {message && <p role="status">{message}</p>}
      {link && (
        <label className="share-link">
          Squad link
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      )}
    </section>
  );
}

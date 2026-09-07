import type { CSSProperties } from "react";
import type { Club } from "@/lib/models";

type Kit = { body: string; sleeves?: string; trim: string; pattern?: string };

// Original club-colour illustrations, not official or season-specific kit artwork.
// Club abbreviations remain stable when FPL's sequential team IDs change.
const kits: Record<string, Kit> = {
  ARS: { body: "#e82737", sleeves: "#fafafa", trim: "#fafafa" },
  AVL: { body: "#811c43", sleeves: "#8dcce9", trim: "#8dcce9" },
  BOU: { body: "#d62435", trim: "#191c26", pattern: "stripes" },
  BRE: { body: "#e53838", trim: "#fff8ee", pattern: "stripes" },
  BHA: { body: "#1971da", trim: "#ffffff", pattern: "stripes" },
  BUR: { body: "#7d2048", sleeves: "#98cce7", trim: "#98cce7" },
  CHE: { body: "#235bea", trim: "#f0f4ff" },
  COV: { body: "#83c6e8", trim: "#ffffff" },
  CRY: { body: "#2855c7", trim: "#e53444", pattern: "stripes" },
  EVE: { body: "#2453bc", trim: "#ffffff" },
  FUL: { body: "#fcfcfc", trim: "#282837" },
  HUL: { body: "#f3af28", trim: "#25252c", pattern: "stripes" },
  IPS: { body: "#2458bd", trim: "#ffffff" },
  LEE: { body: "#ffffff", trim: "#e3b532" },
  LEI: { body: "#2457c2", trim: "#e1c17b" },
  LIV: { body: "#dc2736", trim: "#ffffff" },
  MCI: { body: "#85c8ed", trim: "#ffffff" },
  MUN: { body: "#df2b3c", trim: "#23232c" },
  NEW: { body: "#20222c", trim: "#ffffff", pattern: "stripes" },
  NFO: { body: "#e6373d", trim: "#ffffff" },
  SOU: { body: "#e3363f", trim: "#ffffff", pattern: "stripes" },
  SUN: { body: "#de3038", trim: "#ffffff", pattern: "stripes" },
  TOT: { body: "#fcfcfc", trim: "#192a50" },
  WHU: { body: "#811f42", sleeves: "#8ccce5", trim: "#8ccce5" },
  WOL: { body: "#f7b92b", trim: "#22232a" },
};

export default function ClubKit({
  club,
  goalkeeper = false,
  compact = false,
}: {
  club?: Club;
  goalkeeper?: boolean;
  compact?: boolean;
}) {
  const kit: Kit = goalkeeper
    ? { body: "#ffd747", trim: "#30314c" }
    : (kits[club?.short ?? ""] ?? { body: "#8895af", trim: "#ffffff" });
  const style = {
    "--kit-body": kit.body,
    "--kit-sleeves": kit.sleeves ?? kit.body,
    "--kit-trim": kit.trim,
  } as CSSProperties;
  return (
    <span
      className={`club-kit${compact ? " kit-compact" : ""}`}
      style={style}
      role="img"
      aria-label={`${club?.name ?? "Club"} ${goalkeeper ? "goalkeeper" : "club-colour"} shirt`}
    >
      <span
        className={`kit-silhouette ${kit.pattern === "stripes" ? "kit-striped" : ""}`}
      >
        <span className="kit-body" />
        <span className="kit-collar" />
        <span className="kit-seam" />
      </span>
    </span>
  );
}

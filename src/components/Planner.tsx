"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  Plus,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { z } from "zod";
import {
  Catalog,
  Draft,
  Player,
  SavedState,
  emptyDraft,
  money,
} from "@/lib/models";
import {
  addIssue,
  cost,
  extractEntry,
  formation,
  playersIn,
  upcoming,
  validate,
} from "@/lib/squad";
import Fixtures from "./Fixtures";
import ThemeToggle from "./ThemeToggle";
import ClubKit from "./ClubKit";
import { canSubstitute, substitute } from "@/lib/substitutions";
import { formatXpts, squadProjection } from "@/lib/projections";
const KEY = "touchline:v1";
const draftSchema = z.object({
  id: z.string(),
  name: z.string(),
  picks: z
    .array(z.object({ player: z.number().int(), starter: z.boolean() }))
    .max(15),
  captain: z.number().nullable(),
  vice: z.number().nullable(),
  budget: z.number().int().nonnegative(),
  updated: z.string(),
  imported: z
    .object({
      entry: z.number(),
      gameweek: z.number(),
      team: z.string(),
      manager: z.string(),
    })
    .optional(),
});
const savedSchema = z.object({
  version: z.literal(1),
  drafts: z.array(draftSchema).min(1),
  active: z.string(),
  baseline: z.string().nullable(),
  entry: z.string(),
  preferences: z.object({ sort: z.string(), position: z.number() }),
});
async function api<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Request failed. Please try again.");
  return data;
}
export default function Planner() {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [state, setState] = useState<SavedState | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("builder"),
    [mobile, setMobile] = useState("squad"),
    [search, setSearch] = useState(""),
    [club, setClub] = useState(0),
    [minPrice, setMinPrice] = useState(0),
    [maxPrice, setMaxPrice] = useState(200),
    [available, setAvailable] = useState(false),
    [affordable, setAffordable] = useState(false),
    [limit, setLimit] = useState(40),
    [filters, setFilters] = useState(false);
  const [detail, setDetail] = useState<Player | null>(null),
    [replace, setReplace] = useState<number | undefined>(),
    [entry, setEntry] = useState(""),
    [importing, setImporting] = useState(false),
    [importError, setImportError] = useState(""),
    [history, setHistory] = useState<
      { gameweek: number; points: number; minutes: number }[] | null
    >(null),
    [historyError, setHistoryError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const [quickSub, setQuickSub] = useState<{
    draft: string;
    player: number;
  } | null>(null);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQuickSub(null);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const c = await api<Catalog>("/api/catalog");
      setCatalog(c);
      let restored: SavedState | null = null;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) restored = savedSchema.parse(JSON.parse(raw));
      } catch {
        setNotice(
          "Saved data could not be read. A fresh plan has been opened.",
        );
      }
      if (restored) setEntry(restored.entry);
      const d = emptyDraft(c.rules.budget);
      const initial: SavedState = restored ?? {
        version: 1,
        drafts: [d],
        active: d.id,
        baseline: null,
        entry: "",
        preferences: { sort: "points", position: 0 },
      };
      setState((previous) => previous ?? initial);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // Initial hydration synchronizes the remote catalog and device storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  useEffect(() => {
    if (state)
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        // Surface a failed external storage write to the user.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNotice(
          "Device storage is full or unavailable. Your changes will not survive a reload.",
        );
      }
  }, [state]);
  useEffect(() => {
    if (detail) {
      dialog.current?.showModal();
      // Reset the remote detail request when the selected player changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHistory(null);
      setHistoryError("");
      let active = true;
      api<{ history: { gameweek: number; points: number; minutes: number }[] }>(
        `/api/player/${detail.id}`,
      )
        .then((r) => {
          if (active) setHistory(r.history);
        })
        .catch((e) => {
          if (active) setHistoryError(e.message);
        });
      return () => {
        active = false;
      };
    } else dialog.current?.close();
  }, [detail]);
  const draft =
    state?.drafts.find((d) => d.id === state.active) ?? state?.drafts[0];
  function update(fn: (d: Draft) => Draft) {
    setQuickSub(null);
    if (!draft) return;
    if (state?.baseline === draft.id) {
      setNotice(
        "This is your saved baseline. Duplicate it to make an editable plan.",
      );
      return;
    }
    setState((s) =>
      s
        ? {
            ...s,
            drafts: s.drafts.map((d) =>
              d.id === draft.id
                ? { ...fn(d), updated: new Date().toISOString() }
                : d,
            ),
          }
        : s,
    );
  }
  function create(source?: Draft) {
    setQuickSub(null);
    if (!catalog) return;
    const d = source
      ? {
          ...source,
          id: crypto.randomUUID(),
          name: `${source.name} copy`,
          updated: new Date().toISOString(),
        }
      : emptyDraft(catalog.rules.budget);
    setState((s) => (s ? { ...s, drafts: [...s.drafts, d], active: d.id } : s));
    setReplace(undefined);
    setTab("builder");
  }
  function add(p: Player) {
    if (!draft || !catalog) return;
    const issue = addIssue(draft, p, catalog, replace);
    if (issue) {
      setNotice(issue);
      return;
    }
    update((d) => {
      const old = d.picks.find((x) => x.player === replace);
      const n = d.picks.filter(
        (x) =>
          x.starter &&
          catalog.players.find((p) => p.id === x.player)?.position ===
            p.position,
      ).length;
      const starter =
        old?.starter ??
        (d.picks.filter((x) => x.starter).length < 11 &&
          n < ({ 1: 1, 2: 4, 3: 4, 4: 2 }[p.position] ?? 0));
      return {
        ...d,
        picks: old
          ? d.picks.map((x) =>
              x.player === replace ? { player: p.id, starter } : x,
            )
          : [...d.picks, { player: p.id, starter }],
        captain: d.captain === replace ? p.id : d.captain,
        vice: d.vice === replace ? p.id : d.vice,
      };
    });
    setReplace(undefined);
    setNotice(`${p.name} added to your plan.`);
  }
  async function importEntry() {
    if (!extractEntry(entry)) {
      setImportError("Enter a numeric entry ID or an official FPL entry URL.");
      return;
    }
    setImporting(true);
    setImportError("");
    try {
      const d = await api<Draft>(
        `/api/import?entry=${encodeURIComponent(entry)}`,
      );
      setState((s) =>
        s
          ? {
              ...s,
              drafts: [...s.drafts, d],
              active: d.id,
              baseline: d.id,
              entry,
            }
          : s,
      );
      setTab("builder");
      setNotice(
        "Published team saved as your baseline. Duplicate it to start planning.",
      );
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }
  function remove(id: number) {
    update((d) => ({
      ...d,
      picks: d.picks.filter((p) => p.player !== id),
      captain: d.captain === id ? null : d.captain,
      vice: d.vice === id ? null : d.vice,
    }));
    setDetail(null);
  }
  const logo = (
    <Link href="/" className="brand">
      <span className="brand-icon">
        <ClipboardList size={23} />
      </span>
      touchline<span className="brand-dot">.</span>
    </Link>
  );
  if (!catalog || !state || !draft)
    return (
      <>
        <header className="topbar">
          {logo}
          <span className="local-badge">FPL SQUAD PLANNER</span>
          <ThemeToggle />
        </header>
        <main className="startup">
          <span className="eyebrow">
            A LITTLE FORESIGHT. A BETTER GAMEWEEK.
          </span>
          <h1>
            Your next squad
            <br />
            starts here.
          </h1>
          {loading ? (
            <div
              role="status"
              aria-label="Loading official FPL data"
              className="skeleton-grid"
            >
              <div />
              <div />
              <div />
            </div>
          ) : (
            <div className="error">
              <h2>We couldn’t reach FPL</h2>
              <p>{error}</p>
              <button className="primary" onClick={load}>
                Try again
              </button>
            </div>
          )}
        </main>
      </>
    );
  const issues = validate(draft, catalog),
    remaining = draft.budget - cost(draft, catalog),
    ps = playersIn(draft, catalog),
    locked = state.baseline === draft.id;
  const bench = ps.filter(
    (player) => !draft.picks.find((pick) => pick.player === player.id)?.starter,
  );
  const benchGoalkeepers = bench.filter((player) => player.position === 1);
  const projection = squadProjection(draft, catalog);
  const projectionLabel = catalog.projectionGameweek
    ? `GW${catalog.projectionGameweek}`
    : "Next GW";
  const benchOutfield = bench.filter((player) => player.position !== 1);
  const subPick =
    !locked && quickSub?.draft === draft.id
      ? draft.picks.find((p) => p.player === quickSub.player)
      : undefined;
  const subPlayer = catalog.players.find((p) => p.id === subPick?.player);
  const subCandidates = subPick
    ? draft.picks.filter((p) =>
        canSubstitute(draft, subPick.player, p.player, catalog),
      )
    : [];
  function startQuickSub(id: number) {
    if (locked) return;
    setQuickSub(
      subPick?.player === id ? null : { draft: draft!.id, player: id },
    );
  }
  function finishQuickSub(id: number) {
    if (!subPick) return;
    if (subPick.player === id) {
      setQuickSub(null);
      return;
    }
    if (!canSubstitute(draft!, subPick.player, id, catalog!)) {
      setNotice(
        "Choose a highlighted player on the other side of the bench, or cancel quick sub.",
      );
      return;
    }
    const outgoing = subPick.starter ? subPick.player : id;
    const incoming = subPick.starter ? id : subPick.player;
    const captaincy =
      draft!.captain === outgoing
        ? " Captaincy moves to the incoming player."
        : draft!.vice === outgoing
          ? " Vice-captaincy moves to the incoming player."
          : "";
    update((d) => substitute(d, subPick.player, id, catalog!));
    setNotice(
      `${catalog!.players.find((p) => p.id === incoming)?.name} on, ${catalog!.players.find((p) => p.id === outgoing)?.name} off.${captaincy}`,
    );
  }
  const sorted = catalog.players
    .filter(
      (p) =>
        (!state.preferences.position ||
          p.position === state.preferences.position) &&
        (!club || p.club === club) &&
        p.price >= minPrice &&
        p.price <= maxPrice &&
        (!available || p.status === "a") &&
        (!affordable ||
          p.price <=
            remaining +
              (catalog.players.find((x) => x.id === replace)?.price ?? 0)) &&
        `${p.fullName} ${p.name} ${catalog.clubs.find((c) => c.id === p.club)?.name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const k = state.preferences.sort as
        "price" | "points" | "form" | "ownership" | "ppg";
      return (
        (b[k] ?? b.points) - (a[k] ?? a.points) || a.name.localeCompare(b.name)
      );
    });
  function card(p: Player) {
    const pick = draft!.picks.find((x) => x.player === p.id);
    const selected = subPick?.player === p.id;
    const eligible = subCandidates.some(
      (candidate) => candidate.player === p.id,
    );
    const direction =
      selected || eligible ? (pick?.starter ? "off" : "on") : null;
    return (
      <div
        key={p.id}
        className={`pitch-card${direction ? ` sub-${direction}` : ""}${selected ? " sub-selected" : ""}`}
      >
        <button
          className="pitch-player"
          onClick={() => (subPick ? finishQuickSub(p.id) : setDetail(p))}
          aria-label={
            subPick
              ? selected
                ? `Cancel quick sub for ${p.name}`
                : eligible
                  ? `${pick?.starter ? "Take off" : "Bring on"} ${p.name}`
                  : `${p.name}, not eligible for this substitution`
              : `Manage ${p.name}`
          }
        >
          <span className="player-kit">
            <ClubKit
              club={catalog!.clubs.find((c) => c.id === p.club)}
              goalkeeper={p.position === 1}
            />
            {draft!.captain === p.id ? (
              <b className="captain-marker">C</b>
            ) : draft!.vice === p.id ? (
              <b className="captain-marker vice-marker">V</b>
            ) : null}
            {p.status !== "a" && (
              <span
                className="kit-availability"
                title={p.news || "Availability flagged"}
              >
                !
              </span>
            )}
          </span>
          <strong>{p.name}</strong>
          <span className="player-price-strip">
            {money(p.price)} <i>·</i>{" "}
            {catalog!.clubs.find((c) => c.id === p.club)?.short}
            <span className="sr-only">
              {pick?.starter ? "Starting XI" : "Substitute"}
            </span>
          </span>
          <Fixtures player={p} catalog={catalog!} />
          <span
            className="player-xpts"
            title={`FPL projection for ${projectionLabel}; before captain multiplier`}
          >
            {projectionLabel} xPts{" "}
            <b>
              {formatXpts(
                catalog!.projectionGameweek ? p.expectedPoints : null,
              )}
            </b>
          </span>
        </button>
        <button
          className="quick-sub-button"
          disabled={locked}
          aria-label={
            selected ? `Cancel quick sub for ${p.name}` : `Quick sub ${p.name}`
          }
          aria-pressed={selected}
          title={
            locked
              ? "Duplicate the baseline to make substitutions"
              : "Quick sub"
          }
          onClick={() =>
            eligible ? finishQuickSub(p.id) : startQuickSub(p.id)
          }
        >
          {selected ? <X size={15} /> : <ArrowLeftRight size={15} />}
        </button>
        {direction && (
          <span className="sub-direction">
            {selected ? "Selected · " : ""}
            {direction === "on" ? "ON ↑" : "OFF ↓"}
          </span>
        )}
      </div>
    );
  }
  return (
    <>
      <header className="topbar">
        {logo}
        <nav aria-label="Main navigation">
          {[
            ["builder", "Squad builder"],
            ["drafts", "My drafts"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "nav-active" : ""}
              onClick={() => {
                setTab(id);
                setQuickSub(null);
              }}
            >
              {label}
              {id === "drafts" && (
                <span className="count">{state.drafts.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="local-badge">
            <span /> Saved on this device
          </span>
          <ThemeToggle />
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              FANTASY FOOTBALL · INDEPENDENT PLANNER
            </span>
            <h1>
              {tab === "drafts"
                ? "My saved squads"
                : tab === "import"
                  ? "Import your FPL team"
                  : "Squad planner"}
            </h1>
            <p>Pick your players. Set your captain. Plan your next Gameweek.</p>
          </div>
          <button className="primary" onClick={() => setTab("import")}>
            <Download size={17} /> Import FPL team
          </button>
        </div>
        <div className="context-bar">
          <span>
            <span className="live-dot" /> Official FPL data{" "}
            <small>
              · Updated{" "}
              {new Date(catalog.updated).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          </span>
          <span>
            {catalog.gameweeks.find((w) => w.current)?.name ??
              "Season planning"}{" "}
            <span className="muted"> / Standard FPL</span>
          </span>
        </div>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {tab === "builder" && (
          <>
            <section className="summary">
              <div>
                <span className="metric-label">CURRENT PLAN</span>
                <select
                  aria-label="Current draft"
                  value={draft.id}
                  onChange={(e) => {
                    setQuickSub(null);
                    setState({ ...state, active: e.target.value });
                    setReplace(undefined);
                  }}
                >
                  {state.drafts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {state.baseline === d.id ? " · Baseline" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="metric-label">BUDGET LEFT</span>
                <strong className={remaining < 0 ? "negative" : "green"}>
                  {money(remaining)}
                </strong>
                <small>of {money(draft.budget)}</small>
              </div>
              <div>
                <span className="metric-label">SQUAD</span>
                <strong>
                  {draft.picks.length}
                  <em> / {catalog.rules.size}</em>
                </strong>
                <small>
                  {draft.picks.filter((p) => p.starter).length} starting players
                </small>
              </div>
              <div>
                <span className="metric-label">FORMATION</span>
                <strong>{formation(draft, catalog)}</strong>
                <small>
                  {issues.length
                    ? "Still taking shape"
                    : "Ready for your next move"}
                </small>
              </div>
              <button
                className="icon-button"
                title="Duplicate plan"
                onClick={() => create(draft)}
              >
                <Plus size={20} />
                <span>Duplicate</span>
              </button>
            </section>
            <div className="mobile-tabs">
              <button
                className={mobile === "squad" ? "active" : ""}
                onClick={() => setMobile("squad")}
              >
                My squad
              </button>
              <button
                className={mobile === "players" ? "active" : ""}
                onClick={() => setMobile("players")}
              >
                Find players
              </button>
            </div>
            <div className="builder-grid">
              <section
                className={`squad-panel mobile-${mobile === "squad" ? "show" : "hide"}`}
              >
                <div className="panel-heading">
                  <h2>
                    <Shield size={18} /> The starting XI
                  </h2>
                  <span className="pill">
                    {locked ? "BASELINE" : "PLANNING MODE"}
                  </span>
                </div>
                <div className="projection-summary">
                  <div>
                    <span>{projectionLabel} · Starting XI xPts</span>
                    <strong>{formatXpts(projection.starters)}</strong>
                  </div>
                  <div>
                    <span>Bench xPts</span>
                    <strong>{formatXpts(projection.bench)}</strong>
                  </div>
                  <small>
                    FPL estimates · captain ×2 in XI total · bench excluded. No
                    automatic substitutions or chips.{" "}
                    {draft.picks.filter((p) => p.starter).length !== 11
                      ? "Incomplete XI: selected players only. "
                      : ""}
                    {!draft.picks.some(
                      (p) => p.starter && p.player === draft.captain,
                    )
                      ? "Select a starting captain. "
                      : ""}
                    — means projections are unavailable.
                  </small>
                </div>
                {locked && (
                  <div className="baseline-info">
                    Published GW{draft.imported?.gameweek} picks.{" "}
                    <button onClick={() => create(draft)}>
                      Clone into a plan <ChevronRight size={14} />
                    </button>
                  </div>
                )}
                {subPick && (
                  <div className="quick-sub-banner" role="status">
                    <span>
                      <strong>
                        {subPlayer?.name} {subPick.starter ? "off ↓" : "on ↑"}
                      </strong>
                      {subCandidates.length
                        ? `Choose a ${subPick.starter ? "green substitute to bring on" : "red starter to take off"}.`
                        : "No valid swap is available. Check your lineup or cancel."}
                      <small>
                        Swaps preserve formation rules. Captaincy follows the
                        incoming player.
                      </small>
                    </span>
                    <button onClick={() => setQuickSub(null)}>
                      Cancel <X size={14} />
                    </button>
                  </div>
                )}
                <div className="pitch">
                  <div className="pitch-markings" />
                  {catalog.positions.map((pos) => {
                    const row = ps.filter(
                      (p) =>
                        p.position === pos.id &&
                        draft.picks.find((x) => x.player === p.id)?.starter,
                    );
                    // The default 4–4–2 placeholders only guide an unfinished XI.
                    // A complete lineup renders its actual formation without gaps.
                    const slots =
                      draft.picks.filter((pick) => pick.starter).length >=
                      catalog.rules.starters
                        ? row.length
                        : Math.max(
                            row.length,
                            { 1: 1, 2: 4, 3: 4, 4: 2 }[pos.id] ?? 0,
                          );
                    return (
                      <div className="pitch-row" key={pos.id}>
                        {row.map(card)}
                        {Array.from(
                          { length: Math.max(0, slots - row.length) },
                          (_, i) => (
                            <button
                              key={`empty-${i}`}
                              className="empty-player"
                              onClick={() => {
                                setState({
                                  ...state,
                                  preferences: {
                                    ...state.preferences,
                                    position: pos.id,
                                  },
                                });
                                setMobile("players");
                                setSearch("");
                              }}
                              aria-label={`Find a ${pos.name.toLowerCase()}`}
                            >
                              <span>
                                <Plus size={20} />
                              </span>
                              <small>{pos.short}</small>
                            </button>
                          ),
                        )}
                      </div>
                    );
                  })}
                  <div className="pitch-caption">
                    TOUCHLINE <span> / </span> MAKE YOUR NEXT MOVE
                  </div>
                </div>
                <div className="bench">
                  <div className="bench-heading">
                    <span>SUBSTITUTES BENCH</span>
                    <small>
                      Goalkeeper + 3 outfield players · click to manage
                    </small>
                  </div>
                  <div className="bench-players">
                    {benchGoalkeepers.length ? (
                      benchGoalkeepers.map(card)
                    ) : (
                      <span className="bench-empty">
                        GK
                        <small>Goalkeeper</small>
                      </span>
                    )}
                    {benchOutfield.map(card)}
                    {Array.from(
                      {
                        length: Math.max(0, 3 - benchOutfield.length),
                      },
                      (_, i) => (
                        <span key={i} className="bench-empty">
                          {benchOutfield.length + i + 1}
                          <small>Substitute</small>
                        </span>
                      ),
                    )}
                  </div>
                </div>
                <div className="squad-bottom">
                  <span>
                    <Check size={14} /> Autosaved locally
                  </span>
                  <button
                    onClick={() => {
                      if (confirm("Reset this plan and remove all players?"))
                        update((d) => ({
                          ...d,
                          picks: [],
                          captain: null,
                          vice: null,
                        }));
                    }}
                    disabled={locked}
                  >
                    Reset plan
                  </button>
                </div>
                <details className="validation" open={issues.length === 0}>
                  <summary>
                    {issues.length
                      ? `${issues.length} things to finish your squad`
                      : "Your squad meets all planning rules"}
                    <span>{issues.length ? "View checklist" : "✓"}</span>
                  </summary>
                  <ul>
                    {issues.length ? (
                      issues.map((i) => <li key={i}>{i}</li>)
                    ) : (
                      <li>15 players, valid lineup, budget and captaincy.</li>
                    )}
                  </ul>
                </details>
                <details className="validation">
                  <summary>
                    Club allocation{" "}
                    <span>Maximum {catalog.rules.clubLimit} per club</span>
                  </summary>
                  <div className="club-usage">
                    {catalog.clubs.map((c) => (
                      <span key={c.id}>
                        {c.short}
                        <b>
                          {ps.filter((p) => p.club === c.id).length}/
                          {catalog.rules.clubLimit}
                        </b>
                      </span>
                    ))}
                  </div>
                </details>
              </section>
              <section
                className={`browser-panel mobile-${mobile === "players" ? "show" : "hide"}`}
              >
                <div className="panel-heading">
                  <h2>Find your next difference-maker</h2>
                  <span className="count">{catalog.players.length}</span>
                </div>
                <div className="browser-controls">
                  <div className="search-box">
                    <Search size={17} />
                    <input
                      aria-label="Search players or clubs"
                      placeholder="Search a player or club…"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setLimit(40);
                      }}
                    />
                    <button
                      aria-label="Toggle advanced filters"
                      className={filters ? "selected" : ""}
                      onClick={() => setFilters(!filters)}
                    >
                      <SlidersHorizontal size={17} />
                    </button>
                  </div>
                  <div className="position-tabs">
                    {[
                      { id: 0, short: "All players" },
                      ...catalog.positions,
                    ].map((p) => (
                      <button
                        key={p.id}
                        className={
                          state.preferences.position === p.id ? "active" : ""
                        }
                        onClick={() => {
                          setState({
                            ...state,
                            preferences: {
                              ...state.preferences,
                              position: p.id,
                            },
                          });
                          setLimit(40);
                        }}
                      >
                        {p.short}
                      </button>
                    ))}
                  </div>
                  {filters && (
                    <div className="advanced-filters">
                      <label>
                        Club
                        <select
                          value={club}
                          onChange={(e) => setClub(Number(e.target.value))}
                        >
                          <option value={0}>All clubs</option>
                          {catalog.clubs.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Min price (£m)
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.5"
                          value={minPrice / 10}
                          onChange={(e) =>
                            setMinPrice(Number(e.target.value) * 10)
                          }
                        />
                      </label>
                      <label>
                        Max price (£m)
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.5"
                          value={maxPrice / 10}
                          onChange={(e) =>
                            setMaxPrice(Number(e.target.value) * 10)
                          }
                        />
                      </label>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={available}
                          onChange={(e) => setAvailable(e.target.checked)}
                        />{" "}
                        Available only
                      </label>
                    </div>
                  )}
                  <div className="sort-row">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={affordable}
                        onChange={(e) => setAffordable(e.target.checked)}
                      />{" "}
                      Affordable only
                    </label>
                    <label>
                      Sort by{" "}
                      <select
                        aria-label="Sort players"
                        value={state.preferences.sort}
                        onChange={(e) =>
                          setState({
                            ...state,
                            preferences: {
                              ...state.preferences,
                              sort: e.target.value,
                            },
                          })
                        }
                      >
                        {[
                          ["points", "Total points"],
                          ["price", "Price"],
                          ["form", "Form"],
                          ["ownership", "Ownership"],
                          ["ppg", "Points per game"],
                        ].map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                {replace && (
                  <div className="notice">
                    Replacing{" "}
                    {catalog.players.find((p) => p.id === replace)?.name}
                    <button
                      onClick={() => setReplace(undefined)}
                      aria-label="Cancel replacement"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="player-table">
                  <div className="table-head">
                    <span>PLAYER / NEXT 3</span>
                    <span>PRICE</span>
                    <span>PTS</span>
                    <span />
                  </div>
                  {sorted.slice(0, limit).map((p) => {
                    const selected = draft.picks.some((x) => x.player === p.id),
                      reason = addIssue(draft, p, catalog, replace);
                    return (
                      <div className="player-row" key={p.id}>
                        <button
                          className="player-info"
                          onClick={() => setDetail(p)}
                        >
                          <ClubKit
                            club={catalog.clubs.find((c) => c.id === p.club)}
                            goalkeeper={p.position === 1}
                            compact
                          />
                          <span>
                            <strong>
                              {p.name}
                              {p.status !== "a" && (
                                <span
                                  className="availability"
                                  title={p.news || p.status}
                                >
                                  {" "}
                                  !
                                </span>
                              )}
                            </strong>
                            <small>
                              {
                                catalog.clubs.find((c) => c.id === p.club)
                                  ?.short
                              }{" "}
                              <i>·</i>{" "}
                              {
                                catalog.positions.find(
                                  (x) => x.id === p.position,
                                )?.short
                              }{" "}
                              <i>·</i> Form {p.form.toFixed(1)}
                            </small>
                            <small className="secondary-stats">
                              {p.ownership}% selected · {p.ppg} pts/game
                            </small>
                            <Fixtures player={p} catalog={catalog} />
                          </span>
                        </button>
                        <span className="price">{money(p.price)}</span>
                        <strong className="points">{p.points}</strong>
                        <button
                          className={`add-player ${selected ? "is-selected" : ""}`}
                          disabled={!!reason || locked}
                          title={
                            locked
                              ? "Duplicate the baseline to edit"
                              : (reason ?? `Add ${p.name}`)
                          }
                          aria-label={
                            selected
                              ? `${p.name} selected`
                              : `Add ${p.name}${reason ? `: ${reason}` : ""}`
                          }
                          onClick={() => add(p)}
                        >
                          {selected ? <Check size={17} /> : <Plus size={18} />}
                        </button>
                      </div>
                    );
                  })}
                  {!sorted.length && (
                    <div className="empty-state">
                      <Search />
                      <h3>No players found</h3>
                      <p>Try another name or loosen your filters.</p>
                    </div>
                  )}
                </div>
                <div className="results-footer">
                  <span>
                    {Math.min(limit, sorted.length)} of {sorted.length} players
                  </span>
                  {limit < sorted.length && (
                    <button onClick={() => setLimit(limit + 40)}>
                      Show more <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
        {tab === "import" && (
          <section className="import-panel">
            <span className="feature-icon">
              <Download />
            </span>
            <span className="eyebrow">START WITH YOUR REAL TEAM</span>
            <h2>Bring your squad to the touchline.</h2>
            <p>
              Enter your FPL entry ID or paste your team’s public URL. You can
              find the ID in the address bar on your FPL points page.
            </p>
            <label htmlFor="entry">FPL entry ID or team URL</label>
            <div className="import-input">
              <input
                id="entry"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                placeholder="e.g. 1234567"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void importEntry();
                }}
              />
              <button
                className="primary"
                disabled={importing}
                onClick={importEntry}
              >
                {importing ? "Importing…" : "Import team"}
                <ChevronRight size={17} />
              </button>
            </div>
            {importError && (
              <p role="alert" className="error">
                {importError}
              </p>
            )}
            <div className="info-box">
              <Shield size={20} />
              <div>
                <strong>Public picks. Private planning.</strong>
                <p>
                  FPL only publishes a manager’s lineup after the Gameweek
                  deadline. We import their latest published team, which may
                  differ from their current, unpublished squad. No login needed,
                  and no changes are sent to FPL.
                </p>
              </div>
            </div>
            <p className="muted">
              Imports are saved as a baseline. Clone one to explore your next
              squad.
            </p>
          </section>
        )}
        {tab === "drafts" && (
          <section className="drafts-section">
            <div className="section-title">
              <h2>Your saved plans</h2>
              <button className="primary" onClick={() => create()}>
                <Plus size={16} /> New empty plan
              </button>
            </div>
            <div className="draft-grid">
              {state.drafts.map((d) => (
                <article className="draft-card" key={d.id}>
                  <span className="eyebrow">
                    {state.baseline === d.id
                      ? "SAVED BASELINE"
                      : "LOCAL SQUAD PLAN"}
                  </span>
                  <input
                    aria-label={`Rename ${d.name}`}
                    value={d.name}
                    maxLength={80}
                    onChange={(e) =>
                      setState({
                        ...state,
                        drafts: state.drafts.map((x) =>
                          x.id === d.id ? { ...x, name: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <p>
                    {d.picks.length} players <i>·</i> {formation(d, catalog)}{" "}
                    <i>·</i> {money(cost(d, catalog))}
                  </p>
                  {d.imported && (
                    <small>
                      {d.imported.team} · {d.imported.manager} · Published GW
                      {d.imported.gameweek}
                    </small>
                  )}
                  <div className="draft-actions">
                    <button
                      onClick={() => {
                        setState({ ...state, active: d.id });
                        setTab("builder");
                      }}
                    >
                      Open <ChevronRight size={14} />
                    </button>
                    <button onClick={() => create(d)}>Duplicate</button>
                    <button
                      onClick={() => setState({ ...state, baseline: d.id })}
                    >
                      Set baseline
                    </button>
                    <button
                      aria-label={`Delete ${d.name}`}
                      onClick={() => {
                        if (state.drafts.length === 1) {
                          setNotice(
                            "Create another plan before deleting this one.",
                          );
                          return;
                        }
                        if (confirm(`Delete “${d.name}”?`))
                          setState({
                            ...state,
                            drafts: state.drafts.filter((x) => x.id !== d.id),
                            active:
                              state.active === d.id
                                ? state.drafts.find((x) => x.id !== d.id)!.id
                                : state.active,
                            baseline:
                              state.baseline === d.id ? null : state.baseline,
                          });
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        <footer>
          <span>
            {logo}
            <small>An independent space for your next FPL idea.</small>
          </span>
          <p>
            Unofficial. Not affiliated with the Premier League.
            <br />
            Public FPL data · Local plans · No account changes
          </p>
        </footer>
      </main>
      <dialog
        aria-labelledby="player-detail-title"
        ref={dialog}
        onCancel={() => setDetail(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDetail(null);
        }}
      >
        {detail && (
          <div className="detail-content">
            <button
              className="dialog-close"
              onClick={() => setDetail(null)}
              aria-label="Close player details"
            >
              <X />
            </button>
            <span className="eyebrow">
              {catalog.clubs.find((c) => c.id === detail.club)?.name} /{" "}
              {catalog.positions.find((p) => p.id === detail.position)?.name}
            </span>
            <h2 id="player-detail-title">{detail.fullName}</h2>
            <p className={detail.status === "a" ? "green" : "negative"}>
              {detail.status === "a"
                ? "Available"
                : detail.news || "Currently unavailable or flagged"}
            </p>
            <div className="detail-stats">
              {[
                ["Price", money(detail.price)],
                ["Points", detail.points],
                [
                  `${projectionLabel} xPts`,
                  formatXpts(
                    catalog.projectionGameweek ? detail.expectedPoints : null,
                  ),
                ],
                ["Form", detail.form],
                ["Selected", `${detail.ownership}%`],
                ["Pts / game", detail.ppg],
              ].map(([l, v]) => (
                <div key={l}>
                  <small>{l}</small>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            <h3>Next fixtures</h3>
            <Fixtures player={detail} catalog={catalog} />
            <p className="muted">
              {upcoming(detail, catalog)
                .map(
                  (f) => `GW${f.event ?? "TBC"}: difficulty ${f.difficulty}/5`,
                )
                .join(" · ") || "Fixtures have not been published."}
            </p>
            <h3>Recent Gameweeks</h3>
            {historyError ? (
              <p role="status">{historyError}</p>
            ) : history ? (
              <div className="history">
                {history.slice(-5).map((h) => (
                  <span key={h.gameweek}>
                    <small>GW{h.gameweek}</small>
                    <strong>{h.points} pts</strong>
                    <small>{h.minutes} min</small>
                  </span>
                ))}
                {!history.length && <p>No Gameweek history yet.</p>}
              </div>
            ) : (
              <p role="status">Loading player history…</p>
            )}
            {draft.picks.some((x) => x.player === detail.id) ? (
              <div className="detail-actions">
                <button
                  disabled={locked}
                  onClick={() =>
                    update((d) => ({
                      ...d,
                      picks: d.picks.map((p) =>
                        p.player === detail.id
                          ? { ...p, starter: !p.starter }
                          : p,
                      ),
                      captain: d.captain === detail.id ? null : d.captain,
                      vice: d.vice === detail.id ? null : d.vice,
                    }))
                  }
                >
                  {draft.picks.find((p) => p.player === detail.id)?.starter
                    ? "Move to bench"
                    : "Move to starting XI"}
                </button>
                <button
                  disabled={
                    locked ||
                    !draft.picks.find((p) => p.player === detail.id)?.starter
                  }
                  onClick={() =>
                    update((d) => ({
                      ...d,
                      captain: detail.id,
                      vice: d.vice === detail.id ? d.captain : d.vice,
                    }))
                  }
                >
                  Make captain
                </button>
                <button
                  disabled={
                    locked ||
                    !draft.picks.find((p) => p.player === detail.id)?.starter
                  }
                  onClick={() =>
                    update((d) => ({
                      ...d,
                      vice: detail.id,
                      captain: d.captain === detail.id ? d.vice : d.captain,
                    }))
                  }
                >
                  Make vice-captain
                </button>
                <button
                  disabled={locked}
                  onClick={() => {
                    setReplace(detail.id);
                    setState({
                      ...state,
                      preferences: {
                        ...state.preferences,
                        position: detail.position,
                      },
                    });
                    setDetail(null);
                    setTab("builder");
                    setMobile("players");
                  }}
                >
                  Replace player
                </button>
                <button
                  disabled={locked}
                  className="negative"
                  onClick={() => remove(detail.id)}
                >
                  Remove player
                </button>
                <p className="muted">
                  Lineup changes are checked immediately in the squad checklist.
                </p>
              </div>
            ) : (
              <>
                <button
                  className="primary"
                  disabled={
                    locked || !!addIssue(draft, detail, catalog, replace)
                  }
                  onClick={() => {
                    add(detail);
                    setDetail(null);
                  }}
                >
                  <Plus size={17} /> Add to plan
                </button>
                <p className="muted">
                  {locked
                    ? "Duplicate the baseline to start editing."
                    : addIssue(draft, detail, catalog, replace)}
                </p>
              </>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}

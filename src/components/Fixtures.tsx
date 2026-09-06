import { Catalog, Player } from "@/lib/models";
import { upcoming } from "@/lib/squad";
export default function Fixtures({
  player,
  catalog,
}: {
  player: Player;
  catalog: Catalog;
}) {
  const fs = upcoming(player, catalog);
  return (
    <span className="fixtures">
      {fs.length ? (
        fs.map((f) => (
          <span
            key={f.id}
            className={`fixture fdr-${f.difficulty}`}
            title={`GW ${f.event ?? "TBC"} · ${f.home ? "Home" : "Away"} · difficulty ${f.difficulty}/5`}
          >
            {f.opponent}
            <small>{f.home ? "H" : "A"}</small>
          </span>
        ))
      ) : (
        <span className="muted">TBC</span>
      )}
    </span>
  );
}

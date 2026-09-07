import type { Catalog, Draft } from "./models";
import { formatXpts, projectedTotal, squadProjection } from "./projections";

/** Local canvas rendering avoids external artwork, tracking and cross-origin image failures. */
export async function downloadSquadImage(draft: Draft, catalog: Catalog) {
  if (
    draft.picks.some(
      (p) => !catalog.players.some((player) => player.id === p.player),
    )
  )
    throw new Error("Remove unavailable players before exporting an image.");
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1500;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export is unavailable in this browser.");
  const text = (
    value: string,
    x: number,
    y: number,
    size = 24,
    color = "#ffffff",
    width = 1100,
  ) => {
    ctx.fillStyle = color;
    ctx.font = `600 ${size}px Arial`;
    ctx.fillText(value, x, y, width);
  };
  ctx.fillStyle = "#381354";
  ctx.fillRect(0, 0, 1200, 1500);
  text("TOUCHLINE", 50, 70, 40, "#a7f66b");
  text(draft.name, 50, 125, 32);
  const gw =
    (draft.gameweek ?? catalog.projectionGameweek)
      ? `GW${draft.gameweek ?? catalog.projectionGameweek}`
      : "Next GW";
  const chip =
    draft.chip === "triple-captain"
      ? "Triple Captain ×3"
      : draft.chip === "bench-boost"
        ? "Bench Boost"
        : "No chip";
  text(
    `${gw} · ${chip} · ${formatXpts(projectedTotal(draft, squadProjection(draft, catalog)))} total xPts`,
    50,
    172,
    24,
  );
  for (let row = 0; row < 8; row++) {
    ctx.fillStyle = row % 2 ? "#23854f" : "#278f56";
    ctx.fillRect(35, 200 + row * 125, 1130, 125);
  }
  ctx.strokeStyle = "#ffffff70";
  ctx.lineWidth = 3;
  ctx.strokeRect(55, 220, 1090, 930);
  ctx.beginPath();
  ctx.arc(600, 685, 110, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(55, 685);
  ctx.lineTo(1145, 685);
  ctx.stroke();
  const players = draft.picks.map((pick) => ({
    pick,
    player: catalog.players.find((p) => p.id === pick.player),
  }));
  const card = (
    item: (typeof players)[number],
    x: number,
    y: number,
    width: number,
  ) => {
    const { player, pick } = item;
    ctx.fillStyle = "#381354";
    ctx.fillRect(x - width / 2, y, width, 115);
    ctx.textAlign = "center";
    text(player?.name ?? "Unavailable", x, y + 32, 23, "white", width - 12);
    const club = catalog.clubs.find((c) => c.id === player?.club)?.short ?? "—";
    const role =
      pick.player === draft.captain
        ? draft.chip === "triple-captain"
          ? " · C ×3"
          : " · C ×2"
        : pick.player === draft.vice
          ? " · VC"
          : "";
    text(`${club}${role}`, x, y + 65, 20, "#a7f66b", width - 12);
    text(
      `${formatXpts(catalog.projectionGameweek ? player?.expectedPoints : null)} xPts`,
      x,
      y + 94,
      19,
      "white",
      width - 12,
    );
    ctx.textAlign = "left";
  };
  for (let position = 1; position <= 4; position++) {
    const row = players.filter(
      (p) => p.pick.starter && p.player?.position === position,
    );
    row.forEach((p, i) =>
      card(
        p,
        55 + (1090 * (i + 0.5)) / row.length,
        250 + (position - 1) * 220,
        Math.min(195, 1050 / row.length - 8),
      ),
    );
  }
  const bench = players
    .filter((p) => !p.pick.starter)
    .sort(
      (a, b) =>
        Number(b.player?.position === 1) - Number(a.player?.position === 1),
    );
  text(
    `BENCH · ${draft.chip === "bench-boost" ? "included in total" : "excluded from total"}`,
    50,
    1240,
    22,
    "#a7f66b",
  );
  bench.forEach((p, i) =>
    card(
      p,
      55 + (1090 * (i + 0.5)) / bench.length,
      1260,
      Math.min(240, 1050 / bench.length - 8),
    ),
  );
  text(
    `FPL estimates · Player xPts before captain multiplier · ${draft.picks.length === 15 && draft.picks.filter((p) => p.starter).length === 11 ? "Planning snapshot" : "Incomplete squad"}`,
    50,
    1420,
    19,
  );
  text(
    `${window.location.host} · ${new Date().toISOString().slice(0, 10)}`,
    50,
    1460,
    20,
    "#a7f66b",
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Image export failed."))),
      "image/png",
    ),
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `touchline-${gw.toLowerCase().replaceAll(" ", "-")}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

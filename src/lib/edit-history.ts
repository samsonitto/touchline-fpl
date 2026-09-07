import type { Draft } from "./models";
export type EditHistory = { past: Draft[]; future: Draft[] };
export const emptyHistory = (): EditHistory => ({ past: [], future: [] });
export function recordEdit(history: EditHistory, before: Draft): EditHistory {
  return { past: [...history.past, before].slice(-50), future: [] };
}
export function travel(
  history: EditHistory,
  current: Draft,
  direction: "undo" | "redo",
) {
  const source = direction === "undo" ? history.past : history.future;
  const next = source.at(-1);
  if (!next) return null;
  return {
    draft: { ...next, updated: new Date().toISOString() },
    history:
      direction === "undo"
        ? {
            past: history.past.slice(0, -1),
            future: [...history.future, current],
          }
        : {
            past: [...history.past, current],
            future: history.future.slice(0, -1),
          },
  };
}

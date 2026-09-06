"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";

const key = "touchline:theme";

export default function ThemeToggle() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      let preference: string | null = null;
      try {
        preference = localStorage.getItem(key);
      } catch {
        /* Device storage is optional. */
      }
      document.documentElement.dataset.theme =
        preference === "dark" || preference === "light"
          ? preference
          : media.matches
            ? "dark"
            : "light";
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function toggle() {
    const theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(key, theme);
    } catch {
      /* Keep the toggle usable without storage. */
    }
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Switch between light and dark mode"
    >
      <Moon className="theme-moon" size={18} aria-hidden="true" />
      <Sun className="theme-sun" size={18} aria-hidden="true" />
    </button>
  );
}

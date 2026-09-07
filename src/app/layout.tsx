import type { Metadata } from "next";
import "./globals.css";
import "./football-theme.css";
export const metadata: Metadata = {
  title: "Touchline · FPL Squad Planner",
  description:
    "Your next squad starts here. Build, import and save Fantasy Premier League plans, privately on your device.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{let t;try{t=localStorage.getItem('touchline:theme')}catch{}document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

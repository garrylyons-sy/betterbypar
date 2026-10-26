import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Scoring | Better By Par",
  icons: {
    icon: [{ url: "/live-scoring-icon.svg", type: "image/svg+xml" }],
    shortcut: "/live-scoring-icon.svg"
  }
};

export default function LiveScoringLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}

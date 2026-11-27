import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Real Windy City · Cheyenne City Meetings, Speakers & Records",
  description:
    "Watch Cheyenne city government meetings from 2008 to 2026, see who spoke and what they said, look up the people and companies that come before the city, follow every ordinance from first reading to final vote, and read the original meeting documents.",
};

export const viewport: Viewport = { themeColor: "#07090f" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#07090f] text-slate-100 antialiased">{children}</body>
    </html>
  );
}

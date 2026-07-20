import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/state";
import { AppShell } from "@/components/AppShell";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  // The template gives each route a distinct <title>. Next's route announcer
  // reads document.title on client navigation, so without per-route titles a
  // screen reader user heard the same string after every navigation and got no
  // signal they'd moved. `default` covers the home route and any page that sets
  // none of its own.
  title: {
    default: "DataFolio — KSB portfolio evidence",
    template: "%s · DataFolio",
  },
  description:
    "Capture Level 6 Data Scientist (ST0585) portfolio evidence against every KSB and commit it to your private GitHub repo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Stamps a stored theme choice onto <html> before first paint, so a
            user who picked Light on a dark-mode OS (or vice versa) never sees
            the other scheme flash. Must be inline and blocking — deferring it
            to an effect is precisely what causes the flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}

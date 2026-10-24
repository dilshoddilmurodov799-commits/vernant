import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import { DemoProvider } from "@/lib/demo/store";
import { THEME_COLORS, THEME_SCRIPT } from "@/lib/theme/config";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Vernant", template: "%s · Vernant" },
  description:
    "An 18+ community for bears, chubs, and the people who admire them. Dating, friendship, and community.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Updated client-side to match the active theme.
  themeColor: THEME_COLORS.dark,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The pre-paint script sets data-theme/style before hydration, so attributes may differ from SSR.
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${instrument.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <DemoProvider>
          <ToastProvider>{children}</ToastProvider>
        </DemoProvider>
      </body>
    </html>
  );
}

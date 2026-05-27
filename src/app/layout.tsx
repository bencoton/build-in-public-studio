import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { ThemeProvider } from "@/components/theme-provider";

// WyCo brand fonts, loaded via next/font/google — this is built into Next.js
// (no extra dependency), and Next.js self-hosts the font files so there is no
// runtime call to Google Fonts.
//
// `variable: "--font-..."` exposes each font as a CSS variable that
// tailwind.config.ts then references via fontFamily.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Build-in-Public Studio",
  description:
    "Pull your week's GitHub activity and notes, draft social posts with Claude, review and ship. Local-first, 100% Claude-generated.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning is required by next-themes: it mutates the
    // <html> class on the client to apply the chosen theme, which would
    // otherwise trigger React's class-mismatch warning during hydration.
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <div className="flex min-h-screen">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <AppHeader />
              <main className="flex-1 p-8 animate-fade-in">{children}</main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

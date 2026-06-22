import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NebulaBackground } from "@/components/nebula-background";
import { ProgressiveBlur } from "@/components/progressive-blur";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lepton Duel — the on-chain agent battle arena on Arc",
  description:
    "Duel an adaptive house in one transaction, climb the Elo ladder, earn USDC. Autonomous agents battle on Arc with sub-second finality.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetBrainsMono.variable}`}
    >
      <body className="min-h-screen antialiased">
        <NebulaBackground />
        <ProgressiveBlur />
        {children}
      </body>
    </html>
  );
}

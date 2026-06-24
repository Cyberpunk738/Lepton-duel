import { SiteNav } from "@/components/site-nav";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { DemoDuel } from "@/components/demo-duel";
import { PlaySection } from "@/components/play-section";
import { FeatureBento } from "@/components/feature-bento";
import { Leaderboard } from "@/components/leaderboard";
import { PotBanner } from "@/components/pot-banner";
import { SiteFooter } from "@/components/site-footer";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <HowItWorks />
        <DemoDuel />
        <PlaySection />
        <FeatureBento />
        <Leaderboard />
        <PotBanner />
      </main>
      <SiteFooter />
    </>
  );
}


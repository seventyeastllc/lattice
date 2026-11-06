import NavBar from "@/components/layout/NavBar";
import LatticeHero from "@/components/LatticeHero";
import StatsCallout from "@/features/home/StatsCallout";
import ExploreNetwork from "@/features/home/ExploreNetwork";
import HowItWorks from "@/features/home/HowItWorks";
import ProductExperienceSection from "@/features/home/ProductExperienceSection";
import WhoThisIsFor from "@/features/home/WhoThisIsFor";
import WhyLattice from "@/features/home/WhyLattice";
import FoundationSection from "@/features/home/FoundationSection";

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NavBar />
      <main style={{ flex: 1 }}>
        <LatticeHero />
        <StatsCallout />
        <ExploreNetwork />
        <HowItWorks />
        <ProductExperienceSection />
        <WhoThisIsFor />
        <WhyLattice />
        <FoundationSection />
      </main>
    </div>
  );
}

import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/features/home/HeroSection";
import StatsCallout from "@/features/home/StatsCallout";
import HowItWorks from "@/features/home/HowItWorks";
import WhoThisIsFor from "@/features/home/WhoThisIsFor";
import WhyLattice from "@/features/home/WhyLattice";

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NavBar />
      <main style={{ flex: 1 }}>
        <HeroSection />
        <StatsCallout />
        <HowItWorks />
        <WhoThisIsFor />
        <WhyLattice />
      </main>
      <Footer />
    </div>
  );
}

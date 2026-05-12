import Header from "@/components/sections/Header";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Differentials from "@/components/sections/Differentials";
import ComboPowerTop from "@/components/sections/ComboPowerTop";
import AppSection from "@/components/sections/AppSection";
import WhatsAppSection from "@/components/sections/WhatsAppSection";
import Testimonials from "@/components/sections/Testimonials";
import FAQ from "@/components/sections/FAQ";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main>
        <Hero />
        <About />
        <Differentials />
        <ComboPowerTop />
        <AppSection />
        <WhatsAppSection />
        <Testimonials />
        <FAQ />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}

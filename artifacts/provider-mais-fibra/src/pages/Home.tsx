import SEO from "@/components/SEO";
import {
  FAQ_SCHEMA,
  OFFER_CATALOG_SCHEMA,
  ORGANIZATION_SCHEMA,
  WEBSITE_SCHEMA,
} from "@/lib/seoConfig";
import Header from "@/components/sections/Header";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Differentials from "@/components/sections/Differentials";
import ComboPowerTop from "@/components/sections/ComboPowerTop";
import BannerCarousel from "@/components/sections/BannerCarousel";
import WatchBanner from "@/components/sections/WatchBanner";
import AppSection from "@/components/sections/AppSection";
import WhatsAppSection from "@/components/sections/WhatsAppSection";
import Testimonials from "@/components/sections/Testimonials";
import FAQ from "@/components/sections/FAQ";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <SEO
        title="Internet Fibra Óptica no Oeste da Bahia — Provider Mais Fibra"
        description="Provedor de internet 100% fibra óptica para o Oeste da Bahia. Planos residenciais e empresariais de 100M a 900M, Wi-Fi 6, IPTV inclusos e suporte humano. Assine pelo WhatsApp."
        path="/"
        keywords={[
          "internet fibra óptica Oeste da Bahia",
          "provedor de internet Barreiras",
          "internet fibra Luís Eduardo Magalhães",
          "IPTV Bahia",
          "Wi-Fi 6",
          "plano de internet residencial",
        ]}
        jsonLd={[
          ORGANIZATION_SCHEMA,
          WEBSITE_SCHEMA,
          OFFER_CATALOG_SCHEMA,
          FAQ_SCHEMA,
        ]}
      />
      <Header />
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <About />
        <Differentials />
        <BannerCarousel />
        <ComboPowerTop />
        <WatchBanner />
        <AppSection />
        <WhatsAppSection />
        <Testimonials />
        <FAQ />
      </main>
      <Footer />
      <WhatsAppFloat source="home-sticky" />
    </div>
  );
}

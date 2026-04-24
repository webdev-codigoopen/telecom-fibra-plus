import React from 'react';
import Header from '@/components/sections/Header';
import Hero from '@/components/sections/Hero';
import Differentials from '@/components/sections/Differentials';
import Plans from '@/components/sections/Plans';
import StreamingBanner from '@/components/sections/StreamingBanner';
import IPTVGrid from '@/components/sections/IPTVGrid';
import AppSection from '@/components/sections/AppSection';
import About from '@/components/sections/About';
import Benefits from '@/components/sections/Benefits';
import Coverage from '@/components/sections/Coverage';
import Testimonials from '@/components/sections/Testimonials';
import FAQ from '@/components/sections/FAQ';
import FinalCTA from '@/components/sections/FinalCTA';
import Footer from '@/components/sections/Footer';
import WhatsAppFloat from '@/components/sections/WhatsAppFloat';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main>
        <Hero />
        <Differentials />
        <Plans />
        <StreamingBanner />
        <IPTVGrid />
        <AppSection />
        <About />
        <Benefits />
        <Coverage />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
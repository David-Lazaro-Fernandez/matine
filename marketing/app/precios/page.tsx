import type { Metadata } from 'next';
import { Navigation } from '@/components/navigation';
import { Pricing } from '@/components/pricing';
import { PilotSection } from '@/components/pilot-section';
import { AiSection } from '@/components/ai-section';
import { CtaSection } from '@/components/cta-section';
import { FooterSection } from '@/components/footer-section';

export const metadata: Metadata = {
  title: 'Precios — Matiné',
  description: 'Planes de Matiné por módulos y por puestos, para cadenas y distribuidoras. Contacta a ventas.',
};

export default function Precios() {
  return (
    <>
      <Navigation />
      <main>
        <Pricing />
        <PilotSection />
        <AiSection />
        <CtaSection />
      </main>
      <FooterSection />
    </>
  );
}

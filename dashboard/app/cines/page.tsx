'use client';

// Cines: la venta por cine de los últimos días. No usa el periodo ni la franja de la Cartelera, solo la zona.
import { PageHeader } from '@/components/common';
import { CinesView } from '@/components/cartelera/cines';
import { PlazaSelector, usePlaza } from '@/components/filters';
import { NAV_LABEL } from '@/lib/labels.generated';

export default function Page() {
  const plaza = usePlaza();
  return (
    <>
      <PageHeader title={NAV_LABEL.cines}>
        <PlazaSelector />
      </PageHeader>
      <CinesView plaza={plaza} />
    </>
  );
}

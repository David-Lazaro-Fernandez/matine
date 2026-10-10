'use client';

// Spike de la fase 0: las dos gráficas de la cartelera con datos reales de `dashboard/scripts/spike_data.py`.
import { Subtitle1, makeStyles, tokens } from '@fluentui/react-components';
import data from '@/.spike-data/cartelera.json';
import dynamic from 'next/dynamic';

// Fluent Charts lee `document` al renderizar, así que no puede pasar por el prerender de la exportación estática.
const DaySlotHeatmap = dynamic(() => import('@/components/day-slot-heatmap').then((m) => m.DaySlotHeatmap), { ssr: false });
const MoviesDumbbell = dynamic(() => import('@/components/movies-dumbbell').then((m) => m.MoviesDumbbell), { ssr: false });

const useStyles = makeStyles({
  page: { maxWidth: '1100px', margin: '0 auto', padding: tokens.spacingHorizontalXXL },
  section: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingHorizontalXL,
    marginBottom: tokens.spacingVerticalXXL,
  },
});

export default function Page() {
  const styles = useStyles();
  return (
    <main className={styles.page}>
      <section className={styles.section}>
        <Subtitle1 as="h2">{data.text.dumbbell_title}</Subtitle1>
        <MoviesDumbbell movies={data.dumbbell} axisTitle={data.text.dumbbell_axis} />
      </section>
      <section className={styles.section}>
        <Subtitle1 as="h2">{data.text.heatmap_title}</Subtitle1>
        <DaySlotHeatmap {...data.heatmap} />
      </section>
    </main>
  );
}

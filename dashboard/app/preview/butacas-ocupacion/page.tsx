'use client';

// Vista previa de las gráficas de butacas por película y de corridas de captura, con datos reales de
// `dashboard/scripts/preview_butacas_ocupacion.py`.
import { Subtitle1, makeStyles, tokens } from '@fluentui/react-components';
import data from '@/.spike-data/butacas_ocupacion.json';
import { SeatsDumbbell } from '@/components/cartelera/seats-dumbbell';
import { RunsChart, type RecentRun } from '@/components/operaciones/runs-chart';
import { CHAIN_LABEL, COMPARED, OPS_TEXT, SEATS_CHART_TEXT } from '@/lib/labels.generated';

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
      {COMPARED.map((chain) => (
        <section key={chain} className={styles.section}>
          <Subtitle1 as="h2">{SEATS_CHART_TEXT.title.replace('{chain}', CHAIN_LABEL[chain])}</Subtitle1>
          <SeatsDumbbell rows={data.seats[chain]} chain={chain} />
        </section>
      ))}
      <section className={styles.section}>
        <Subtitle1 as="h2">{OPS_TEXT.runs}</Subtitle1>
        <RunsChart runs={data.runs as RecentRun[]} />
      </section>
    </main>
  );
}

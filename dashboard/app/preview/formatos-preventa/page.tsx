'use client';

// Vista previa de las gráficas de formatos y preventa con datos reales de `dashboard/scripts/preview_formatos_preventa.py`.
import { makeStyles, tokens } from '@fluentui/react-components';
import data from '@/.spike-data/formatos_preventa.json';
import { MixBars } from '@/components/cartelera/mix-bars';
import { PresaleBars, type PresaleRow } from '@/components/cartelera/presale-bars';
import { PresaleCurve } from '@/components/cartelera/presale-curve';

const useStyles = makeStyles({
  page: { maxWidth: '1100px', margin: '0 auto', padding: tokens.spacingHorizontalXXL },
  section: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingHorizontalXL,
    marginBottom: tokens.spacingVerticalXXL,
  },
  columns: { display: 'grid', gridTemplateColumns: '3fr 2fr', gap: tokens.spacingHorizontalXL },
});

export default function Page() {
  const styles = useStyles();
  const presale = data.presale as PresaleRow[];
  const both = presale.filter((r) => r.status === 'ambas');
  const single = presale.filter((r) => r.status !== 'ambas');
  return (
    <main className={styles.page}>
      <section className={styles.section} id="formatos">
        <div className={styles.columns}>
          <MixBars rows={data.mix} dimension="format" />
          <MixBars rows={data.mix} dimension="language" />
        </div>
      </section>
      <section className={styles.section} id="preventa">
        {both.length > 0 && <PresaleBars rows={both} paired />}
        {single.length > 0 && <PresaleBars rows={single} paired={false} />}
        <PresaleCurve curves={data.curves} />
      </section>
    </main>
  );
}

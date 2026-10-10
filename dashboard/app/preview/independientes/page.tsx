'use client';

// Vista previa de las gráficas de la oferta independiente con datos reales de `dashboard/scripts/preview_independientes.py`.
// La ocupación se pinta aunque `occupancy_readable` sea falso, solo para comparar la gráfica.
import { Subtitle1, makeStyles, tokens } from '@fluentui/react-components';
import type { ComponentProps } from 'react';
import data from '@/.spike-data/independientes.json';
import { IndepOccupancyHeatmap } from '@/components/independientes/occupancy-heatmap';
import { IndepOverlapBars } from '@/components/independientes/overlap-bars';
import { IndepSlotsBars } from '@/components/independientes/slots-bars';
import { IndepTitlesBars } from '@/components/independientes/titles-bars';
import { INDEP_TEXT } from '@/lib/labels.generated';

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
  const sections = [
    [INDEP_TEXT.programa_chart, <IndepTitlesBars key="t" titles={data.titles as ComponentProps<typeof IndepTitlesBars>['titles']} />],
    [INDEP_TEXT.ocupacion_chart, <IndepOccupancyHeatmap key="o" cells={data.occupancy as ComponentProps<typeof IndepOccupancyHeatmap>['cells']} />],
    [INDEP_TEXT.solape_chart, <IndepOverlapBars key="s" titles={data.overlap as ComponentProps<typeof IndepOverlapBars>['titles']} />],
    [INDEP_TEXT.franjas_chart, <IndepSlotsBars key="f" slots={data.slots as ComponentProps<typeof IndepSlotsBars>['slots']} />],
  ] as const;
  return (
    <main className={styles.page}>
      {sections.map(([title, chart]) => (
        <section key={title} className={styles.section}>
          <Subtitle1 as="h2">{title}</Subtitle1>
          {chart}
        </section>
      ))}
    </main>
  );
}

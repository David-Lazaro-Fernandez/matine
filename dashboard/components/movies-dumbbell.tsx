'use client';

// Dumbbell de películas: el % de la programación de cada cadena por película, unidos por una línea, con la diferencia
// escrita a la derecha.
import { LineChart, type ChartAnnotation, type LineChartPoints } from '@fluentui/react-charts';
import { CHAIN_COLOR, CHAIN_LABEL, COMPARED, GRAY_DARK, NEUTRAL, US } from '@/lib/labels.generated';

type Chain = (typeof COMPARED)[number];
type Movie = {
  title: string;
  delta: string;
  winner: string;
  tooltip: Partial<Record<Chain, string>>;
} & Record<`share_${Chain}` | `shows_${Chain}`, number | null>;

export function MoviesDumbbell({ movies, axisTitle }: { movies: Movie[]; axisTitle: string }) {
  // LineChart no tiene eje de categorías en y: cada película es un número de fila y el eje lo traduce al título.
  const rowOf = (index: number) => movies.length - index;
  const titleOf = (row: number) => movies[movies.length - row]?.title ?? '';
  const both = (m: Movie) => COMPARED.every((c) => m[`shows_${c}`]);

  // Una serie de línea por película y un punto por película y cadena. El modo 'markers' de LineChart 9.3 crea
  // Fragments sin `key` y React avisa en desarrollo. Por eso cada punto es una línea de largo cero con punta
  // redonda: dos puntos iguales, sin 'markers', con el color de la cadena.
  const lines: LineChartPoints[] = movies.flatMap((m, i) => both(m) ? [{
    legend: m.title,
    color: NEUTRAL,
    hideNonActiveDots: true,
    lineOptions: { strokeWidth: 2, mode: 'lines' as const },
    data: COMPARED.map((c) => ({ x: m[`share_${c}`] ?? 0, y: rowOf(i), hideCallout: true })),
  }] : []);
  const dots: LineChartPoints[] = movies.flatMap((m, i) => COMPARED.filter((c) => m[`shows_${c}`]).map((c) => {
    const point = { x: m[`share_${c}`] ?? 0, y: rowOf(i), xAxisCalloutData: m.title, yAxisCalloutData: m.tooltip[c] };
    return {
      legend: `${m.title} · ${CHAIN_LABEL[c]}`,
      color: CHAIN_COLOR[c],
      hideNonActiveDots: true,
      lineOptions: { strokeWidth: 12, strokeLinecap: 'round' as const, mode: 'lines' as const },
      data: [point, point],
    };
  }));

  const annotations: ChartAnnotation[] = movies.map((m, i) => ({
    text: m.delta,
    coordinates: { type: 'mixed', xCoordinateType: 'relative', yCoordinateType: 'data', x: 1, y: rowOf(i) },
    layout: { align: 'start', verticalAlign: 'middle', offsetX: 8, clipToBounds: false },
    style: {
      textColor: m.winner === US ? CHAIN_COLOR[US] : GRAY_DARK,
      fontWeight: 700,
      backgroundColor: 'transparent',
      borderWidth: 0,
      boxShadow: 'none',
    },
  }));

  return (
    <LineChart
      data={{ lineChartData: [...lines, ...dots] }}
      annotations={annotations}
      xAxisTitle={axisTitle}
      xMinValue={0}
      yAxisTickValues={movies.map((_, i) => rowOf(i))}
      yAxisTickFormat={titleOf}
      yMinValue={0.5}
      yMaxValue={movies.length + 0.5}
      hideLegend
      height={24 * movies.length + 80}
      margins={{ left: 300, right: 120, top: 10, bottom: 50 }}
    />
  );
}

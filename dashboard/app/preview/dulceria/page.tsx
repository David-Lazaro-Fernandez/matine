'use client';

// Vista previa de las gráficas de dulcería con datos reales de `dashboard/scripts/preview_dulceria.py`.
import { makeStyles, tokens } from '@fluentui/react-components';
import data from '@/.spike-data/dulceria.json';
import { DeliveryCompareBars } from '@/components/dulceria/delivery-compare-bars';
import { ProductPriceByCinema } from '@/components/dulceria/product-price-by-cinema';

const useStyles = makeStyles({
  page: { maxWidth: '1100px', margin: '0 auto', padding: tokens.spacingHorizontalXXL, display: 'flex', gap: tokens.spacingHorizontalXXL },
  section: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingHorizontalXL,
  },
});

export default function Page() {
  const styles = useStyles();
  return (
    <main className={styles.page}>
      <section className={styles.section} style={{ flex: 3 }}>
        <DeliveryCompareBars rows={data.delivery_compare} />
      </section>
      {data.basket_row && (
        <section className={styles.section} style={{ flex: 2 }}>
          <ProductPriceByCinema rows={data.product_by_cinema} basket={data.basket_row} />
        </section>
      )}
    </main>
  );
}

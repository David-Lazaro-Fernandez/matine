'use client';

// Página vacía del cascarón. La llena su rama de la ola 3 (docs/plan-dashboard-nextjs.md).
import { Title1 } from '@fluentui/react-components';
import { PAGE_LABEL } from '@/lib/labels.generated';

export default function Page() {
  return <Title1 as="h1">{PAGE_LABEL.independientes}</Title1>;
}

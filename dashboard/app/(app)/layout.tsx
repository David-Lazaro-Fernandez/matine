import { ModuleFrame } from '@/components/module-frame';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ModuleFrame>{children}</ModuleFrame>;
}

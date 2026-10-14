import { SettingsFrame } from '@/components/settings-frame';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SettingsFrame>{children}</SettingsFrame>;
}

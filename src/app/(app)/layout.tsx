import { Shell } from "@/components/Shell";
import { AppProvider } from "@/components/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}

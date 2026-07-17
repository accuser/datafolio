import { AppProvider } from "@/lib/state";
import { DataFolioApp } from "@/components/DataFolioApp";

export default function Home() {
  return (
    <AppProvider>
      <DataFolioApp />
    </AppProvider>
  );
}

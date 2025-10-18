import { Dashboard } from "@/components/dashboard/dashboard";
import { getDashboardSnapshot } from "@/lib/data-source";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await getDashboardSnapshot();
  return <Dashboard initialData={snapshot} />;
}

import { InsightsView } from "@/components/insights-view";
import { getDashboardSummary, getMonthlySnapshots } from "@/lib/api";

export default async function InsightsPage() {
  const [summary, snapshots] = await Promise.all([getDashboardSummary(), getMonthlySnapshots()]);
  return <InsightsView summary={summary} snapshots={snapshots} />;
}


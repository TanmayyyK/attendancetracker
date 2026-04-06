"use client";
import { DashboardView } from "@/components/dashboard-view";
import { getCumulativeSubjects, getDashboardSummary } from "@/lib/api";

export default async function HomePage() {
  const [summary, cumulative] = await Promise.all([getDashboardSummary(), getCumulativeSubjects()]);
  return <DashboardView summary={summary} cumulativeSubjects={cumulative} />;
}

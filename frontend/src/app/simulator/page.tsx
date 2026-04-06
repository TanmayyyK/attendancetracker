import { SimulatorView } from "@/components/simulator-view";
import { getSimulatorSubjects } from "@/lib/api";

export default async function SimulatorPage() {
  const subjects = await getSimulatorSubjects();
  return <SimulatorView subjects={subjects} />;
}


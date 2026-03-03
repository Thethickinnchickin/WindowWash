import { WorkerJobsView } from "@/components/worker/jobs-view";

export default function UpcomingPage() {
  return <WorkerJobsView title="Upcoming" initialRange="week" />;
}

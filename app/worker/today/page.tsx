import { WorkerJobsView } from "@/components/worker/jobs-view";

export default function TodayPage() {
  return <WorkerJobsView title="Today" initialRange="today" />;
}

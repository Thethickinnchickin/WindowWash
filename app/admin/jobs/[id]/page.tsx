import { AdminJobDetail } from "@/components/admin/job-detail";

export default async function AdminJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminJobDetail jobId={id} />;
}

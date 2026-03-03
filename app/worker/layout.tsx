import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { WorkerShell } from "@/components/worker/shell";

export default async function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "worker") {
    redirect("/admin");
  }

  return <WorkerShell>{children}</WorkerShell>;
}

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AdminShell } from "@/components/admin/shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/team/sign-in");
  }

  if (user.role !== "admin") {
    redirect("/worker/today");
  }

  return <AdminShell>{children}</AdminShell>;
}

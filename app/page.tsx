import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/book");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  redirect("/worker/today");
}

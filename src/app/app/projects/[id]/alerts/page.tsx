import { redirect } from "next/navigation";

export default async function ProjectAlertsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/app/alerts?brand=${id}`);
}

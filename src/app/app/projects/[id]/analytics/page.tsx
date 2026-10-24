import { redirect } from "next/navigation";

export default async function ProjectAnalyticsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/app/analytics?brand=${id}`);
}

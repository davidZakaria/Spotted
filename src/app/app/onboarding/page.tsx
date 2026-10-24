import { requireSession } from "@/lib/auth";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export default async function OnboardingPage() {
  const session = await requireSession();
  return <OnboardingWizard locale={session.locale} />;
}

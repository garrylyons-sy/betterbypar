import { redirect } from "next/navigation";

import { LiveScoringDashboard } from "@/components/live-scoring-dashboard";
import { currentUser } from "@/lib/server/auth";
import { requireLeagueChairScoringAccess } from "@/lib/server/live-scoring";

export const dynamic = "force-dynamic";

export default async function LiveScoringPage() {
  const user = await currentUser();
  if (!user || !await requireLeagueChairScoringAccess(user.personId)) redirect("/");

  return <LiveScoringDashboard userName={user.name} />;
}

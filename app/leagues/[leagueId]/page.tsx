import { LeaguePage } from "../../league-manager";

type LeagueRouteProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueRoute({ params }: LeagueRouteProps) {
  const { leagueId } = await params;
  return <LeaguePage leagueId={leagueId} />;
}

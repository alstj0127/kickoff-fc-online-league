import { redirect } from "next/navigation";
import { SetupPage } from "./league-manager";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const query = await searchParams;
  const legacyLeagueId =
    typeof query.league === "string" ? query.league.trim() : "";

  if (legacyLeagueId) {
    redirect(`/leagues/${encodeURIComponent(legacyLeagueId)}`);
  }

  return (
    <SetupPage
      notice={
        query.deleted === "1" ? "리그 일정이 삭제되었습니다." : undefined
      }
    />
  );
}

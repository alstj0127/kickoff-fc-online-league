import {
  errorResponse,
  getSupabase,
  hashPin,
  isNewManagerPin,
  readLeague,
} from "./shared";

type Pair = { home: number; away: number };
type LeagueListRow = {
  id: string;
  name: string;
  updated_at: string;
};
type TeamLeagueRow = { league_id: string };
type MatchLeagueRow = { league_id: string; home_score: number | null };

function isValidSchedule(
  schedule: Pair[],
  teamCount: number,
  meetingsPerPair: 1 | 2,
) {
  const expectedMatches = ((teamCount * (teamCount - 1)) / 2) * meetingsPerPair;
  if (schedule.length !== expectedMatches) return false;
  const pairCounts = new Map<string, number>();
  const directionCounts = new Map<string, number>();
  for (const match of schedule) {
    if (
      !Number.isInteger(match.home) ||
      !Number.isInteger(match.away) ||
      match.home < 0 ||
      match.away < 0 ||
      match.home >= teamCount ||
      match.away >= teamCount ||
      match.home === match.away
    )
      return false;
    const pairKey = [match.home, match.away].sort((a, b) => a - b).join("-");
    const directionKey = `${match.home}-${match.away}`;
    pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
    directionCounts.set(
      directionKey,
      (directionCounts.get(directionKey) ?? 0) + 1,
    );
  }
  if (
    pairCounts.size !== (teamCount * (teamCount - 1)) / 2 ||
    [...pairCounts.values()].some((count) => count !== meetingsPerPair)
  )
    return false;
  return (
    meetingsPerPair === 1 ||
    [...directionCounts.values()].every((count) => count === 1)
  );
}

function createId() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(
    { length: 8 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

export async function GET() {
  try {
    const db = getSupabase();
    const { data: leagues, error: leagueError } = await db
      .from("leagues")
      .select("id, name, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (leagueError) throw leagueError;

    const leagueRows = (leagues ?? []) as LeagueListRow[];
    if (!leagueRows.length) {
      return Response.json(
        { leagues: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const leagueIds = leagueRows.map((league) => league.id);
    const [teamResult, matchResult] = await Promise.all([
      db.from("teams").select("league_id").in("league_id", leagueIds),
      db
        .from("matches")
        .select("league_id, home_score")
        .in("league_id", leagueIds),
    ]);
    if (teamResult.error) throw teamResult.error;
    if (matchResult.error) throw matchResult.error;

    const teamCounts = new Map<string, number>();
    ((teamResult.data ?? []) as TeamLeagueRow[]).forEach((team) => {
      teamCounts.set(team.league_id, (teamCounts.get(team.league_id) ?? 0) + 1);
    });
    const matchCounts = new Map<string, number>();
    const playedCounts = new Map<string, number>();
    ((matchResult.data ?? []) as MatchLeagueRow[]).forEach((match) => {
      matchCounts.set(
        match.league_id,
        (matchCounts.get(match.league_id) ?? 0) + 1,
      );
      if (match.home_score !== null) {
        playedCounts.set(
          match.league_id,
          (playedCounts.get(match.league_id) ?? 0) + 1,
        );
      }
    });

    return Response.json(
      {
        leagues: leagueRows.map((league) => ({
          id: league.id,
          name: league.name,
          updatedAt: league.updated_at,
          teamCount: teamCounts.get(league.id) ?? 0,
          matchCount: matchCounts.get(league.id) ?? 0,
          playedCount: playedCounts.get(league.id) ?? 0,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      teamNames?: string[];
      pin?: string;
      meetingsPerPair?: 1 | 2;
      schedule?: Pair[];
    };
    const name = body.name?.trim() ?? "";
    const teamNames = body.teamNames?.map((team) => team.trim()) ?? [];
    const pin = body.pin ?? "";
    const meetingsPerPair = body.meetingsPerPair === 2 ? 2 : 1;
    const schedule = Array.isArray(body.schedule) ? body.schedule : [];
    if (!name || name.length > 32)
      return Response.json(
        { error: "리그 이름을 확인해 주세요." },
        { status: 400 },
      );
    if (
      teamNames.length < 3 ||
      teamNames.length > 9 ||
      teamNames.some((team) => !team || team.length > 18)
    ) {
      return Response.json(
        { error: "참가자는 3~9명, 팀명은 18자 이하로 입력해 주세요." },
        { status: 400 },
      );
    }
    if (new Set(teamNames).size !== teamNames.length)
      return Response.json(
        { error: "팀명은 서로 달라야 합니다." },
        { status: 400 },
      );
    if (!isNewManagerPin(pin))
      return Response.json(
        { error: "관리 PIN은 숫자 6자리여야 합니다." },
        { status: 400 },
      );
    if (!isValidSchedule(schedule, teamNames.length, meetingsPerPair)) {
      return Response.json(
        { error: "경기 일정이 올바르지 않습니다. 일정을 다시 생성해 주세요." },
        { status: 400 },
      );
    }

    const db = getSupabase();
    const id = createId();
    const pinHash = await hashPin(id, pin);
    const { error: leagueError } = await db.from("leagues").insert({
      id,
      name,
      pin_hash: pinHash,
    });
    if (leagueError) throw leagueError;

    const { data: storedTeams, error: teamError } = await db
      .from("teams")
      .insert(
        teamNames.map((team, seed) => ({
          league_id: id,
          name: team,
          seed,
        })),
      )
      .select("id, seed");
    if (teamError || !storedTeams) {
      await db.from("leagues").delete().eq("id", id);
      throw teamError ?? new Error("참가자 정보를 저장하지 못했습니다.");
    }
    const ids = new Map(
      storedTeams.map((team: { id: number; seed: number }) => [
        team.seed,
        team.id,
      ]),
    );
    const { error: matchError } = await db.from("matches").insert(
      schedule.map((pair, index) => ({
        league_id: id,
        round: index + 1,
        home_team_id: ids.get(pair.home),
        away_team_id: ids.get(pair.away),
      })),
    );
    if (matchError) {
      await db.from("leagues").delete().eq("id", id);
      throw matchError;
    }
    const league = await readLeague(id);
    return Response.json({ league }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

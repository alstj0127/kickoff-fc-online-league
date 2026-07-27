import {
  errorResponse,
  getSupabase,
  hashPin,
  readLeague,
} from "./shared";

type Pair = { home: number; away: number };

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
    if (!/^\d{4}$/.test(pin))
      return Response.json(
        { error: "관리 PIN은 숫자 4자리여야 합니다." },
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

import { ensureSchema, errorResponse, getD1, hashPin, readLeague } from "./shared";

type Pair = { home: number; away: number };

function makeSchedule(teamCount: number) {
  const allPairs: Pair[] = [];
  for (let home = 0; home < teamCount; home += 1) {
    for (let away = home + 1; away < teamCount; away += 1) {
      allPairs.push(Math.random() > 0.5 ? { home, away } : { home: away, away: home });
    }
  }

  let best: Pair[] = [];
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const remaining = [...allPairs].sort(() => Math.random() - 0.5);
    const schedule: Pair[] = [];
    let penalty = 0;
    while (remaining.length) {
      const previous = schedule.at(-1);
      const twoBack = schedule.at(-2);
      let candidateIndex = 0;
      let candidatePenalty = Number.POSITIVE_INFINITY;
      remaining.forEach((pair, index) => {
        const overlapsPrevious = previous
          ? [pair.home, pair.away].filter((id) => id === previous.home || id === previous.away).length
          : 0;
        const overlapsTwoBack = twoBack
          ? [pair.home, pair.away].filter((id) => id === twoBack.home || id === twoBack.away).length
          : 0;
        const score = overlapsPrevious * 100 + overlapsTwoBack * 8 + Math.random() * 4;
        if (score < candidatePenalty) {
          candidatePenalty = score;
          candidateIndex = index;
        }
      });
      penalty += candidatePenalty;
      schedule.push(remaining.splice(candidateIndex, 1)[0]);
    }
    if (penalty < bestPenalty) {
      best = schedule;
      bestPenalty = penalty;
    }
  }
  return best;
}

function createId() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; teamNames?: string[]; pin?: string };
    const name = body.name?.trim() ?? "";
    const teamNames = body.teamNames?.map((team) => team.trim()) ?? [];
    const pin = body.pin ?? "";
    if (!name || name.length > 32) return Response.json({ error: "리그 이름을 확인해줘." }, { status: 400 });
    if (teamNames.length < 3 || teamNames.length > 9 || teamNames.some((team) => !team || team.length > 18)) {
      return Response.json({ error: "참가자는 3~9명, 팀명은 18자 이하로 입력해줘." }, { status: 400 });
    }
    if (new Set(teamNames).size !== teamNames.length) return Response.json({ error: "팀명은 서로 달라야 해." }, { status: 400 });
    if (!/^\d{4}$/.test(pin)) return Response.json({ error: "관리 PIN은 숫자 4자리여야 해." }, { status: 400 });

    await ensureSchema();
    const db = getD1();
    const id = createId();
    const pinHash = await hashPin(id, pin);
    const schedule = makeSchedule(teamNames.length);
    const leagueInsert = db.prepare("INSERT INTO leagues (id, name, pin_hash) VALUES (?1, ?2, ?3)").bind(id, name, pinHash);
    const teamInserts = teamNames.map((team, seed) =>
      db.prepare("INSERT INTO teams (league_id, name, seed) VALUES (?1, ?2, ?3)").bind(id, team, seed),
    );
    await db.batch([leagueInsert, ...teamInserts]);

    const storedTeams = await db
      .prepare("SELECT id, seed FROM teams WHERE league_id = ?1 ORDER BY seed")
      .bind(id)
      .all<{ id: number; seed: number }>();
    const ids = new Map(storedTeams.results.map((team: { id: number; seed: number }) => [team.seed, team.id]));
    const matchInserts = schedule.map((pair, index) =>
      db.prepare("INSERT INTO matches (league_id, round, home_team_id, away_team_id) VALUES (?1, ?2, ?3, ?4)")
        .bind(id, index + 1, ids.get(pair.home), ids.get(pair.away)),
    );
    await db.batch(matchInserts);
    const league = await readLeague(id);
    return Response.json({ league }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

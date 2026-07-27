import { env } from "cloudflare:workers";

type TeamRow = { id: number; name: string; seed: number };
type MatchRow = {
  id: number;
  round: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
};

export type LeagueResponse = {
  id: string;
  name: string;
  updatedAt: string;
  teams: { id: number; name: string; seed: number }[];
  matches: {
    id: number;
    round: number;
    homeTeamId: number;
    awayTeamId: number;
    homeScore: number | null;
    awayScore: number | null;
  }[];
};

export function getD1() {
  if (!env.DB) throw new Error("데이터베이스 연결을 확인하고 있어. 잠시 후 다시 시도해줘.");
  return env.DB;
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema() {
  if (schemaReady) return schemaReady;
  const db = getD1();
  schemaReady = db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS leagues (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, pin_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS teams (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE, name TEXT NOT NULL, seed INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE, round INTEGER NOT NULL, home_team_id INTEGER NOT NULL REFERENCES teams(id), away_team_id INTEGER NOT NULL REFERENCES teams(id), home_score INTEGER, away_score INTEGER, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS teams_league_idx ON teams (league_id)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS teams_league_name_idx ON teams (league_id, name)"),
    db.prepare("CREATE INDEX IF NOT EXISTS matches_league_idx ON matches (league_id)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS matches_league_round_idx ON matches (league_id, round)"),
  ]).then(() => undefined).catch((error: unknown) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

export async function hashPin(leagueId: string, pin: string) {
  const bytes = new TextEncoder().encode(`${leagueId}:${pin}:kickoff-v1`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function readLeague(id: string): Promise<LeagueResponse | null> {
  await ensureSchema();
  const db = getD1();
  const league = await db
    .prepare("SELECT id, name, updated_at FROM leagues WHERE id = ?1")
    .bind(id)
    .first<{ id: string; name: string; updated_at: string }>();
  if (!league) return null;

  const [teamResult, matchResult] = await db.batch([
    db.prepare("SELECT id, name, seed FROM teams WHERE league_id = ?1 ORDER BY seed").bind(id),
    db.prepare("SELECT id, round, home_team_id, away_team_id, home_score, away_score FROM matches WHERE league_id = ?1 ORDER BY round").bind(id),
  ]);
  const teamRows = teamResult.results as unknown as TeamRow[];
  const matchRows = matchResult.results as unknown as MatchRow[];
  return {
    id: league.id,
    name: league.name,
    updatedAt: league.updated_at,
    teams: teamRows.map((team) => ({ id: team.id, name: team.name, seed: team.seed })),
    matches: matchRows.map((match) => ({
      id: match.id,
      round: match.round,
      homeTeamId: match.home_team_id,
      awayTeamId: match.away_team_id,
      homeScore: match.home_score,
      awayScore: match.away_score,
    })),
  };
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "예상하지 못한 오류가 발생했어.";
  const missingTable = message.includes("no such table") || message.includes("leagues");
  return Response.json(
    { error: missingTable ? "리그 저장소를 준비하고 있어. 잠시 후 다시 시도해줘." : message },
    { status: 500 },
  );
}

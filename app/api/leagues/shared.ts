import "server-only";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

type LeagueRow = {
  id: string;
  name: string;
  updated_at: string;
};

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
  meetingsPerPair: 1 | 2;
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

let supabaseClient: SupabaseClient | null = null;

export function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "데이터베이스 연결이 아직 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  supabaseClient = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return supabaseClient;
}

export async function hashPin(leagueId: string, pin: string) {
  const bytes = new TextEncoder().encode(`${leagueId}:${pin}:kickoff-v1`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function readLeague(id: string): Promise<LeagueResponse | null> {
  const db = getSupabase();
  const { data: league, error: leagueError } = await db
    .from("leagues")
    .select("id, name, updated_at")
    .eq("id", id)
    .maybeSingle<LeagueRow>();

  if (leagueError) throw leagueError;
  if (!league) return null;

  const [teamResult, matchResult] = await Promise.all([
    db
      .from("teams")
      .select("id, name, seed")
      .eq("league_id", id)
      .order("seed", { ascending: true }),
    db
      .from("matches")
      .select(
        "id, round, home_team_id, away_team_id, home_score, away_score",
      )
      .eq("league_id", id)
      .order("round", { ascending: true }),
  ]);

  if (teamResult.error) throw teamResult.error;
  if (matchResult.error) throw matchResult.error;

  const teamRows = (teamResult.data ?? []) as TeamRow[];
  const matchRows = (matchResult.data ?? []) as MatchRow[];
  return {
    id: league.id,
    name: league.name,
    updatedAt: league.updated_at,
    meetingsPerPair:
      matchRows.length === teamRows.length * (teamRows.length - 1) ? 2 : 1,
    teams: teamRows.map((team) => ({
      id: team.id,
      name: team.name,
      seed: team.seed,
    })),
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
  console.error("KICKOFF API error", error);
  const message =
    error instanceof Error &&
    error.message.startsWith("데이터베이스 연결이 아직")
      ? error.message
      : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  return Response.json({ error: message }, { status: 500 });
}

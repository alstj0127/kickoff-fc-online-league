import {
  errorResponse,
  getSupabase,
  hashPin,
  readLeague,
} from "../../../shared";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; matchId: string }> },
) {
  try {
    const { id, matchId } = await context.params;
    const body = (await request.json()) as {
      pin?: string;
      homeScore?: number | null;
      awayScore?: number | null;
    };
    const pin = body.pin ?? "";
    const bothEmpty = body.homeScore === null && body.awayScore === null;
    const bothScores =
      Number.isInteger(body.homeScore) &&
      Number.isInteger(body.awayScore) &&
      Number(body.homeScore) >= 0 &&
      Number(body.homeScore) <= 99 &&
      Number(body.awayScore) >= 0 &&
      Number(body.awayScore) <= 99;
    if (!bothEmpty && !bothScores)
      return Response.json(
        { error: "스코어는 양쪽 모두 0~99 사이로 입력해 주세요." },
        { status: 400 },
      );

    const db = getSupabase();
    const { data: league, error: leagueError } = await db
      .from("leagues")
      .select("pin_hash")
      .eq("id", id)
      .maybeSingle<{ pin_hash: string }>();
    if (leagueError) throw leagueError;
    if (!league)
      return Response.json(
        { error: "존재하지 않는 리그입니다." },
        { status: 404 },
      );
    if ((await hashPin(id, pin)) !== league.pin_hash)
      return Response.json(
        { error: "관리 PIN이 맞지 않습니다." },
        { status: 403 },
      );

    const { data: updatedMatch, error: matchError } = await db
      .from("matches")
      .update({
        home_score: body.homeScore,
        away_score: body.awayScore,
        updated_at: new Date().toISOString(),
      })
      .eq("id", Number(matchId))
      .eq("league_id", id)
      .select("id")
      .maybeSingle();
    if (matchError) throw matchError;
    if (!updatedMatch)
      return Response.json(
        { error: "경기를 찾지 못했습니다." },
        { status: 404 },
      );
    const { error: updateLeagueError } = await db
      .from("leagues")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);
    if (updateLeagueError) throw updateLeagueError;
    return Response.json({ league: await readLeague(id) });
  } catch (error) {
    return errorResponse(error);
  }
}

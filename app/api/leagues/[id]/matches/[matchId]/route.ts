import {
  ensureSchema,
  errorResponse,
  getD1,
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
        { error: "스코어는 양쪽 모두 0~99 사이로 입력해주세요." },
        { status: 400 },
      );

    await ensureSchema();
    const db = getD1();
    const league = await db
      .prepare("SELECT pin_hash FROM leagues WHERE id = ?1")
      .bind(id)
      .first<{ pin_hash: string }>();
    if (!league)
      return Response.json({ error: "존재하지 않는 리그야." }, { status: 404 });
    if ((await hashPin(id, pin)) !== league.pin_hash)
      return Response.json(
        { error: "관리 PIN이 맞지 않습니다." },
        { status: 403 },
      );

    const result = await db
      .prepare(
        "UPDATE matches SET home_score = ?1, away_score = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3 AND league_id = ?4",
      )
      .bind(body.homeScore, body.awayScore, Number(matchId), id)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: "경기를 찾지 못했습니다." },
        { status: 404 },
      );
    await db
      .prepare(
        "UPDATE leagues SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
      )
      .bind(id)
      .run();
    return Response.json({ league: await readLeague(id) });
  } catch (error) {
    return errorResponse(error);
  }
}

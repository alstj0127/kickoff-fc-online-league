import {
  errorResponse,
  getSupabase,
  hashPin,
  readLeague,
} from "../shared";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const league = await readLeague(id);
    if (!league)
      return Response.json(
        { error: "존재하지 않는 리그입니다." },
        { status: 404 },
      );
    return Response.json({ league }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { pin?: string };
    const pin = body.pin ?? "";
    if (!/^\d{4}$/.test(pin)) {
      return Response.json(
        { error: "관리 PIN 4자리를 입력해 주세요." },
        { status: 400 },
      );
    }

    const db = getSupabase();
    const { data: league, error: leagueError } = await db
      .from("leagues")
      .select("pin_hash")
      .eq("id", id)
      .maybeSingle<{ pin_hash: string }>();
    if (leagueError) throw leagueError;
    if (!league) {
      return Response.json(
        { error: "존재하지 않는 리그입니다." },
        { status: 404 },
      );
    }
    if ((await hashPin(id, pin)) !== league.pin_hash) {
      return Response.json(
        { error: "관리 PIN이 맞지 않습니다." },
        { status: 403 },
      );
    }

    const { data: deletedLeague, error: deleteError } = await db
      .from("leagues")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (deleteError) throw deleteError;
    if (!deletedLeague) {
      return Response.json(
        { error: "리그를 찾지 못했습니다." },
        { status: 404 },
      );
    }
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}

import { errorResponse, readLeague } from "../shared";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const league = await readLeague(id);
    if (!league) return Response.json({ error: "존재하지 않는 리그야." }, { status: 404 });
    return Response.json({ league }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

import { failure, playerSummary, rateLimit } from "@/lib/server";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (rateLimit(request))
    return Response.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 },
    );
  const { id } = await params;
  if (!/^\d{1,7}$/.test(id) || Number(id) < 1)
    return Response.json({ error: "Invalid player ID." }, { status: 400 });
  try {
    return Response.json(await playerSummary(Number(id)));
  } catch (e) {
    return failure(e);
  }
}

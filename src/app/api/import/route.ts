import { extractEntry } from "@/lib/squad";
import { failure, importTeam, rateLimit } from "@/lib/server";
export async function GET(request: Request) {
  if (rateLimit(request))
    return Response.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 },
    );
  const id = extractEntry(new URL(request.url).searchParams.get("entry") ?? "");
  if (!id)
    return Response.json(
      {
        error: "Enter a valid numeric FPL entry ID or official FPL entry URL.",
      },
      { status: 400 },
    );
  try {
    return Response.json(await importTeam(id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}

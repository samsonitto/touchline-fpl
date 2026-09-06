import { failure, getCatalog, rateLimit } from "@/lib/server";
export async function GET(request: Request) {
  if (rateLimit(request))
    return Response.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 },
    );
  try {
    return Response.json(await getCatalog(), {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    return failure(e);
  }
}

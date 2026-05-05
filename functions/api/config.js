export async function onRequestGet(context) {
  const mapsApiKey = context.env.MAPS_API_KEY;

  if (!mapsApiKey) {
    return new Response(
      JSON.stringify({ error: "MAPS_API_KEY is not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  return new Response(
    JSON.stringify({ mapsApiKey }),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
}

import { json, requireSession } from "../_utils/auth.js";

export async function onRequest(context) {
  const session = await requireSession(context.request, context.env);
  if (!session) {
    return json({ error: "Unauthorized" }, 401);
  }

  const apiKey = context.env.Maps_API_KEY;

  if (!apiKey) {
    return json({ error: "API Key not found in environment" }, 500);
  }

  return json({ Maps_API_KEY: apiKey });
}

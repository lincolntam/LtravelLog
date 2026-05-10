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

  const user = context.env.DB
    ? await context.env.DB.prepare(
      "SELECT email, username, role FROM users WHERE email = ?"
    ).bind(session.email).first()
    : null;

  return json({
    Maps_API_KEY: apiKey,
    user: {
      email: user?.email || session.email,
      username: user?.username || session.email.split("@")[0],
      role: user?.role || "user"
    }
  });
}

import { jwtVerify } from "jose";

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.JWT_SECRET) {
    return jsonResponse({ error: "JWT_SECRET is not configured" }, 500);
  }

  const auth = request.headers.get("Authorization");

  if (!auth || !auth.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const token = auth.replace("Bearer ", "");

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.JWT_SECRET)
    );

    return jsonResponse({
      username: payload.username,
      loggedIn: true
    });
  } catch {
    return jsonResponse({ error: "Invalid or expired token" }, 401);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

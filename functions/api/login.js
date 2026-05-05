import { SignJWT } from "jose";
import bcrypt from "bcryptjs";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { username, password } = body;

  if (!username || !password) {
    return jsonResponse({ error: "Username and password are required" }, 400);
  }

  // TODO: Move this user record to Cloudflare D1 / KV / Supabase later.
  // Default demo user:
  // username: admin
  // password: admin123
  const user = {
    username: "admin",
    password_hash: "$2a$10$7QJ7v6Q7Zr8Qk8J1K7lH6uQ5X8vYz1m8e2ZQk3xQf3GJr9sT1yK2e"
  };

  const isUsernameValid = username === user.username;
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isUsernameValid || !isPasswordValid) {
    return jsonResponse({ error: "Invalid login" }, 401);
  }

  if (!env.JWT_SECRET) {
    return jsonResponse({ error: "JWT_SECRET is not configured" }, 500);
  }

  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(env.JWT_SECRET));

  return jsonResponse({ token });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

import {
    getClientIp,
    hashPassword,
    json,
    normalizeEmail,
    rateLimit
} from "../_utils/auth.js";

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const email = normalizeEmail(body.email);
        const username = String(body.username || "").trim();
        const password = String(body.password || "");
        const code = String(body.code || "");
        const validCode = env.INVITATION_CODE;

        if (!env.DB) {
            return json({ error: "Database binding missing" }, 500);
        }

        if (!validCode) {
            return json({ error: "Server configuration error" }, 500);
        }

        if (!email || !username || !password || !code) {
            return json({ error: "Missing required fields" }, 400);
        }

        if (username.length < 2 || username.length > 40) {
            return json({ error: "Username must be 2-40 characters" }, 400);
        }

        if (password.length < 8) {
            return json({ error: "Password must be at least 8 characters" }, 400);
        }

        const ip = getClientIp(request);
        const limit = await rateLimit(env, `signup:${ip}:${email}`, 5, 60 * 60);
        if (!limit.allowed) {
            return json(
                { error: "嘗試次數太多，請稍後再試" },
                429,
                { "Retry-After": String(limit.retryAfter) }
            );
        }

        if (code !== validCode) {
            return json({ error: "Invalid invitation code" }, 403);
        }

        const existingUser = await env.DB.prepare(
            "SELECT id FROM users WHERE email = ?"
        ).bind(email).first();

        if (existingUser) {
            return json({ error: "Email already registered" }, 409);
        }

        const passwordHash = await hashPassword(password);
        await env.DB.prepare(
            "INSERT INTO users (email, username, password, role) VALUES (?, ?, ?, 'user')"
        ).bind(email, username, passwordHash).run();

        return json({ message: "Success" }, 201);
    } catch (e) {
        console.error("Signup API Error:", e);
        return json({ error: "Database error" }, 500);
    }
}

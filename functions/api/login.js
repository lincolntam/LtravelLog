import {
    createSessionHeaders,
    getClientIp,
    json,
    normalizeEmail,
    rateLimit,
    verifyPassword
} from "../_utils/auth.js";

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const email = normalizeEmail(body.email);
        const password = String(body.password || "");

        if (!email || !password) {
            return json({ error: "請填寫 Email 和密碼" }, 400);
        }

        if (!env.DB) {
            console.error("D1 Database binding 'DB' is missing.");
            return json({ error: "資料庫連線未設定 (Database binding missing)" }, 500);
        }

        const ip = getClientIp(request);
        const limit = await rateLimit(env, `login:${ip}:${email}`, 8, 15 * 60);
        if (!limit.allowed) {
            return json(
                { error: "嘗試次數太多，請稍後再試" },
                429,
                { "Retry-After": String(limit.retryAfter) }
            );
        }

        const user = await env.DB.prepare(
            "SELECT * FROM users WHERE email = ?"
        ).bind(email).first();

        if (!user) {
            return json({ error: "Email 或密碼不正確" }, 401);
        }

        const passwordResult = await verifyPassword(password, user.password, env);
        if (!passwordResult.ok) {
            return json({ error: "Email 或密碼不正確" }, 401);
        }

        return json(
            { message: "登入成功", status: "success" },
            200,
            await createSessionHeaders(email, env)
        );
    } catch (err) {
        console.error("Login API Error:", err);
        return json({ error: "伺服器內部錯誤" }, 500);
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const { email, password, code } = await request.json();

    // ✅ 從 Cloudflare 環境變數讀取，不再寫死在代碼裡
    const VALID_CODE = env.INVITATION_CODE; 

    if (!VALID_CODE) {
        return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500 });
    }

    if (code !== VALID_CODE) {
        return new Response(JSON.stringify({ error: "Invalid invitation code" }), { status: 403 });
    }

    try {
        const existingUser = await env.DB.prepare(
            "SELECT id FROM users WHERE email = ?"
        ).bind(email).first();

        if (existingUser) {
            return new Response(JSON.stringify({ error: "Email already registered" }), { status: 409 });
        }

        await env.DB.prepare(
            "INSERT INTO users (email, password) VALUES (?, ?)"
        ).bind(email, password).run();

        return new Response(JSON.stringify({ message: "Success" }), { status: 201 });

    } catch (e) {
        return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
    }
}

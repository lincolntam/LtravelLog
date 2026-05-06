import { requireSession } from "./_utils/auth.js";

export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    const protectedPaths = [
        "/",
        "/index.html",
        "/api/config"
    ];

    if (!protectedPaths.includes(url.pathname)) {
        return next();
    }

    const session = await requireSession(request, env);
    if (session) {
        return next();
    }

    if (url.pathname.startsWith("/api/")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store"
            }
        });
    }

    return Response.redirect(`${url.origin}/login.html`, 302);
}

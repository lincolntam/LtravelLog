import { requireSession } from "./_utils/auth.js";

export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    const protectedPaths = [
        "/",
        "/home",
        "/home.html",
        "/route",
        "/route.html",
        "/tunnel-fee",
        "/tunnel-fee.html",
        "/charging-fee",
        "/charging-fee.html",
        "/profile",
        "/profile.html",
        "/explore",
        "/explore.html",
        "/api/config"
    ];

    const path = normalizePath(url.pathname);

    if (!protectedPaths.includes(path)) {
        return next();
    }

    const session = await requireSession(request, env);
    if (session) {
        if (path === "/") {
            return Response.redirect(`${url.origin}/home.html`, 302);
        }
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

function normalizePath(pathname) {
    if (pathname.length > 1 && pathname.endsWith("/")) {
        return pathname.slice(0, -1);
    }
    return pathname;
}

const SESSION_COOKIE = "__Host-ltravellog_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 120000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...extraHeaders
        }
    });
}

export function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

export function getClientIp(request) {
    return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
}

export async function hashPassword(password, env) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    try {
        const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
        return `pbkdf2$${PBKDF2_ITERATIONS}$${base64url(salt)}$${base64url(hash)}`;
    } catch (error) {
        console.error("PBKDF2 password hashing failed, using HMAC fallback:", error);
        const hash = await passwordHmac(password, salt, env);
        return `hmac-sha256$${base64url(salt)}$${base64url(hash)}`;
    }
}

export async function verifyPassword(password, storedPassword, env) {
    if (!storedPassword) return { ok: false, legacy: false };

    if (storedPassword.startsWith("hmac-sha256$")) {
        const parts = storedPassword.split("$");
        if (parts.length !== 3) return { ok: false, legacy: false };

        const salt = fromBase64url(parts[1]);
        const expected = fromBase64url(parts[2]);
        const actual = await passwordHmac(password, salt, env);

        return { ok: timingSafeEqual(actual, expected), legacy: false };
    }

    if (!storedPassword.startsWith("pbkdf2$")) {
        return { ok: storedPassword === password, legacy: true };
    }

    const parts = storedPassword.split("$");
    if (parts.length !== 4) return { ok: false, legacy: false };

    const iterations = Number(parts[1]);
    const salt = fromBase64url(parts[2]);
    const expected = fromBase64url(parts[3]);
    const actual = await pbkdf2(password, salt, iterations);

    return { ok: timingSafeEqual(actual, expected), legacy: false };
}

export async function createSessionHeaders(email, env) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sub: email,
        iat: now,
        exp: now + SESSION_TTL_SECONDS
    };
    const token = await signToken(payload, env);
    return {
        "Set-Cookie": `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`
    };
}

export function clearSessionHeaders() {
    return {
        "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    };
}

export async function requireSession(request, env) {
    const token = getCookie(request, SESSION_COOKIE);
    if (!token) return null;

    const payload = await verifyToken(token, env);
    if (!payload || !payload.sub) return null;

    return { email: payload.sub };
}

export async function rateLimit(env, key, limit, windowSeconds) {
    if (!env.DB) return { allowed: true, remaining: limit };

    const now = Math.floor(Date.now() / 1000);
    const resetAt = now + windowSeconds;

    await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS auth_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL)"
    ).run();

    await env.DB.prepare(
        `INSERT INTO auth_rate_limits (key, count, reset_at)
         VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET
           count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
           reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END`
    ).bind(key, resetAt, now, now, resetAt).run();

    const row = await env.DB.prepare(
        "SELECT count, reset_at FROM auth_rate_limits WHERE key = ?"
    ).bind(key).first();

    const count = row?.count || 1;
    return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        retryAfter: Math.max(1, (row?.reset_at || resetAt) - now)
    };
}

async function pbkdf2(password, salt, iterations) {
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
        key,
        256
    );
    return new Uint8Array(bits);
}

async function signToken(payload, env) {
    const header = { alg: "HS256", typ: "JWT" };
    const body = `${base64urlJson(header)}.${base64urlJson(payload)}`;
    const signature = await hmac(body, getJwtSecret(env));
    return `${body}.${base64url(signature)}`;
}

async function verifyToken(token, env) {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const body = `${parts[0]}.${parts[1]}`;
    const expected = await hmac(body, getJwtSecret(env));
    const actual = fromBase64url(parts[2]);
    if (!timingSafeEqual(actual, expected)) return null;

    try {
        const payload = JSON.parse(decoder.decode(fromBase64url(parts[1])));
        if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch {
        return null;
    }
}

async function hmac(value, secret) {
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function passwordHmac(password, salt, env) {
    const saltText = base64url(salt);
    return hmac(`${saltText}.${password}`, getJwtSecret(env));
}

function getJwtSecret(env) {
    if (!env.JWT_SECRET || String(env.JWT_SECRET).length < 32) {
        throw new Error("JWT_SECRET must be at least 32 characters");
    }
    return env.JWT_SECRET;
}

function getCookie(request, name) {
    const cookie = request.headers.get("Cookie") || "";
    return cookie
        .split(";")
        .map(part => part.trim())
        .find(part => part.startsWith(`${name}=`))
        ?.slice(name.length + 1) || "";
}

function base64urlJson(value) {
    return base64url(encoder.encode(JSON.stringify(value)));
}

function base64url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
    return result === 0;
}

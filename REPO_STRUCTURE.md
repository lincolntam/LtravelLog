# LtravelLog Cloudflare Pages Structure

Use this clean structure for Cloudflare Pages deployment.

## Real backend API

Only this root-level folder is used by Cloudflare Pages Functions:

```text
/functions/api/
```

These files become API routes:

```text
/functions/api/login.js   -> /api/login
/functions/api/me.js      -> /api/me
/functions/api/config.js  -> /api/config
```

## Frontend files

Static frontend files stay in:

```text
/public/
```

Frontend helper files:

```text
/public/auth.js
/public/config.js
```

## Important

Do not create API files inside these locations:

```text
/public/functions/
src/functions/
app/functions/
```

Cloudflare Pages will not treat those as backend API routes.

## Cloudflare Environment Variables

Set these in Cloudflare Pages:

```text
JWT_SECRET
MAPS_API_KEY
```

Also restrict the Google Maps API key in Google Cloud Console by HTTP referrer.

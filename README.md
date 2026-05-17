# LTravelLog

LTravelLog is a mobile-first Hong Kong trip cost planner for EV drivers. It combines Google Maps routing, Hong Kong tunnel toll rules, and electricity cost assumptions into one route summary.

Current app version: `v0.55.12`

## Features

- PWA home screen with quick access to planner, tunnel fee, charging fee, explore, and profile pages.
- Authenticated login/signup flow using Cloudflare Pages Functions and D1.
- Route planner using Google Maps, Places Autocomplete, and Directions.
- Outbound and return-trip planning with separate route display.
- Manual multi-select tunnel choices for outbound and return routes.
- Direction-based tunnel waypoints using northbound/southbound gate coordinates.
- Tunnel pass detection from route geometry for selected Hong Kong tunnels.
- Private car toll calculation, including time-varying harbour crossing tolls.
- Charging cost and fuel-car comparison summary.

## Main Pages

- `home.html` - PWA home screen.
- `route.html` - trip planner and map.
- `tunnel-fee.html` - tunnel toll reference and current-time fee lookup.
- `charging-fee.html` - charging cost information.
- `explore.html` - information hub.
- `profile.html` - user profile/info page.
- `login.html` - login and signup entry.
- `index.html` - compatibility redirect to `route.html`.

## Stack

- Static HTML, CSS, and vanilla JavaScript.
- Google Maps JavaScript API, Places API, and Directions API.
- Cloudflare Pages for hosting.
- Cloudflare Pages Functions for API routes.
- Cloudflare D1 for user storage.

## Cloudflare Configuration

Required environment variables:

- `Maps_API_KEY` - Google Maps browser API key.
- `JWT_SECRET` - at least 32 characters, used for session signing.
- `INVITATION_CODE` - signup invitation code.

Required binding:

- `DB` - Cloudflare D1 database binding.

## Deploy

This project is designed for Cloudflare Pages. From the project root:

```bash
npx wrangler pages deploy . --project-name ltravellog --branch main --commit-dirty=true
```

Production URL:

```text
https://ltravellog.pages.dev
```

## Notes

Tunnel fees and time-varying toll logic are data-driven in `app.js`. When Hong Kong toll rules change, update the toll tables and gate coordinate data before deploying.

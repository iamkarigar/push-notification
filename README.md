# Karigar Notifications

Node.js notifications service for Karigar: **team OTP login**, **Expo push tokens**, and **notification APIs** ported from `Karigar_server-new-` (orders, labour jobs, team WhatsApp to `TEAM_MEMBERS_NUMBERS`).

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and set:

- `ANALYTICS_MONGO_URL` — native Mongo client (**TEAM** db for team users)
- `MONGO_URL` or `MONGODB_URI` — **mongoose** (same DB as main Karigar server for orders, `Orders` db for labour jobs/materials)
- `JWT_SECRET`, `SECTRT_KEY`, `REFRESH_KEY` — team JWT
- `MSG91_AUTH_KEY`, `SENDER_ID`, `TEMPLATE_ID` — OTP
- `TEAM_MEMBERS_NUMBERS`, `MSG91_WHATSAPP_INTEGRATED_NUMBER` — team WhatsApp bulk (comma-separated, country code, no `+`)
- `NEW_ORDER_TEMPLATE_ID` — optional, for merchant new-order SMS

### Change streams (optional)

Requires MongoDB **replica set** (change streams). After the HTTP server starts, watchers listen for **inserts** and run the same logic as the notification APIs via `src/services/teamNotificationBasicFunctions.js` (direct function calls, not HTTP).

- `ENABLE_TEAM_COLLECTION_WATCHERS` — defaults to **enabled** (`true`). Set to `false` to turn off all collection watchers.

Optional per-collection toggles (default `true` when the master flag is on): `ENABLE_TEAM_WATCH_USERS`, `ENABLE_TEAM_WATCH_LABOURS`, `ENABLE_TEAM_WATCH_MERCHANTS`, `ENABLE_TEAM_WATCH_MATERIAL_ORDERS`, `ENABLE_TEAM_WATCH_JOB_REQUIREMENTS`, `ENABLE_TEAM_WATCH_ORDER_INITIATE`.

- `TEAM_WATCH_DEDUPE_MS` — dedupe window for repeated events (default 5 minutes)

| Collection | Same behaviour as API |
|------------|------------------------|
| `users` | `POST /api/v1/notifications/user-registered-notify-team` |
| `labors` | `POST /api/v1/notifications/labour-registered-notify-team` |
| `merchents` | `POST /api/v1/notifications/merchant-login-notify-team` |
| `Orders.materials` | `POST /api/v1/notifications/new-order-notify-team` |
| `Orders.labour_job_requirements` | `POST /api/v1/notifications/job-requirement-notify-labours` |
| `temp_orders` | `POST /api/v1/notifications/order-initiate-notify-team` |

## Run

```bash
npm start
```

Development (with file watching):

```bash
npm run dev
```

## API

### Team v1 (OTP login)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/team/v1/send_otp` | `{ "mobile_number": "91..." }` | Send OTP |
| POST | `/team/v1/verify_otp` | `{ "mobile_number", "otp" }` | Verify; **TEAM** db **users** |
| POST | `/team/v1/store-team-tokens` | `{ "expoPushToken" }` | `Authorization: Bearer <access_Token>` |

### `/api/v1/notifications` (from Karigar_server-new-)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/notifications/new-merchant-order` | Merchant Expo + SMS (new material order) |
| POST | `/api/v1/notifications/order-status-update` | User Expo (order status) |
| POST | `/api/v1/notifications/order-initiate-notify-team` | Team Expo: someone is trying to buy XYZ material for XYZ amount |
| POST | `/api/v1/notifications/job-requirement-application` | Poster Expo (labour applied) |
| POST | `/api/v1/notifications/job-requirement-notify-labours` | Nearby labours Expo + **team Expo** (`notifyTeamForLabourRequirement` in `teamNotifications.js`) |
| GET | `/api/v1/notifications/job-requirement-no-application-due` | List jobs with no applications (scheduled helper) |
| POST | `/api/v1/notifications/job-requirement-labour-selected` | Labour selected: Expo to labour + **team WhatsApp** (`notifyTeamAboutLabourSelectionOnWhatsapp`) — *added here; not wired on original server* |

Team **Expo** alerts for job/material flows live in `src/services/teamNotifications.js`; **WhatsApp** helpers in `src/services/teamWhatsappNotifications.js`.

## Requirements

- Node.js 18 or later

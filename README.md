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
| POST | `/api/v1/notifications/job-requirement-application` | Poster Expo (labour applied) |
| POST | `/api/v1/notifications/job-requirement-notify-labours` | Nearby labours Expo + **team WhatsApp** (`notifyTeamForLabourRequirement`) |
| GET | `/api/v1/notifications/job-requirement-no-application-due` | List jobs with no applications (scheduled helper) |
| POST | `/api/v1/notifications/job-requirement-labour-selected` | Labour selected: Expo to labour + **team WhatsApp** (`notifyTeamAboutLabourSelectionOnWhatsapp`) — *added here; not wired on original server* |

Team WhatsApp helpers live in `src/services/teamNotifications.js` and `src/services/teamWhatsappNotifications.js`.

## Requirements

- Node.js 18 or later

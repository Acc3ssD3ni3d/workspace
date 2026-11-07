# EduOne Workspace (Google Workspace–style, runs on your VPS)

## Blueprint
| Module | What it does | Where |
|---|---|---|
| Admin console | Admin adds members as name@eduoneinternational.com with a temp password, resets passwords, disables/enables, promotes | /admin, /api/admin/users |
| Login | Email + password, 7-day httpOnly session; disabled users are locked out immediately | /login |
| Drive | Nested folders, resumable chunked uploads (1 GB+ videos), Range streaming, trash/restore, sharing (people, everyone-at-company), quota | /drive, /api/files |
| Docs / Sheets | Rich-text docs, spreadsheets with formulas, shared view/edit, 5-second sync between editors | /docs, /sheets, /api/docs |
| Calendar | One shared company calendar, every member can add/edit/delete, optional Meet link | /calendar, /api/events |
| Meet | Video meetings through Jitsi (free). Calendar events link straight in | /meet |
| Chat | General channel + private 1:1 messages (polling every 1.5 s) | /chat, /api/chat |

Roles: **admin** (everything, sees all files) and **member**. Sharing roles: viewer / editor. Folder sharing applies to everything inside.

## Run locally
1. `npm install`  2. fill `.env.local` (MongoDB + AUTH_SECRET)  3. `npm run seed` (creates admin@eduoneinternational.com)  4. `npm run dev`

## Deploy on the VPS
- MongoDB local, app via `npm run build && pm2 start "npm start" --name workspace`.
- `mkdir -p /var/lib/eduone-workspace && chown <app user> /var/lib/eduone-workspace`, set `STORAGE_DIR` to it.
- Nginx: reverse proxy to :3000, HTTPS (certbot), `client_max_body_size 16m;` (uploads are 8 MB chunks).
- Cron daily: `npm run cleanup` (removes abandoned uploads).
- Check `df -h`; keep 25+ GB free. Quota is `QUOTA_BYTES`.

## Not included (be aware)
- **Real inboxes** (name@eduoneinternational.com receiving mail) need a mail service: Google Workspace, Zoho Mail (free tier), or self-hosted Mailcow (needs ~6 GB RAM, too heavy for 4 GB). This app only creates the login identity.
- Docs sync is last-save-wins (no live cursors); no file versions yet; no external share links yet.

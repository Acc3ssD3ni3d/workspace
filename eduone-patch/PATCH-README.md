# EduOne Workspace patch - calendars, drive months, meet audience, chat groups + files, notifications

## Install
1. Unzip this patch INTO the project root (`eduone-workspace/`), choose "replace" for existing files.
2. `npm run dev`  (no new packages, no new .env values, no migration needed)
3. Optional .env.local value: `CHAT_MAX_FILE_BYTES=500000000` (max size of one chat attachment, default 500 MB)

## New files
lib/calendar-access.ts            who can edit org calendar + visibility rules
lib/notify.ts                     in-app notifications helper
lib/chat-access.ts                general / dm / group access rules
app/api/calendar/access/route.ts
app/api/notifications/route.ts
app/api/chat/groups/route.ts
app/api/chat/attachments/route.ts
app/api/chat/attachments/[id]/route.ts
app/api/files/structure/route.ts  year / month folders
components/NotificationBell.tsx

## Replaced files
lib/models.ts                     (new fields + ChatGroup + Notification models)
lib/calendar-notifications.ts
app/api/events/route.ts
app/api/meet/route.ts
app/api/chat/route.ts
app/api/files/route.ts            (hides chat attachments from Drive)
app/api/admin/users/route.ts      (orgCalendarEditor flag)
app/(app)/calendar/page.tsx
app/(app)/meet/page.tsx
app/(app)/chat/page.tsx
app/(app)/drive/page.tsx          (only: smart month open + "This month" button)
app/(app)/admin/users/page.tsx    (calendar editor button)
components/MeetRoom.tsx
components/Chat.tsx
components/Shell.tsx              (bell added)
components/AdminShell.tsx         (bell added)

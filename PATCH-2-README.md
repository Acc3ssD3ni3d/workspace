# EduOne Workspace - patch 2
Drive views + Empty trash, protected chat files, calendar editors + holidays, personal email, notifications, new purple/orange UI.

## Install
1. Unzip INTO the project root (eduone-workspace/), choose "replace" for existing files.
2. npm run dev   (no new packages, no migration)
3. Optional .env.local:  CHAT_ALLOW_PC_UPLOAD=false   -> chat can only attach Drive files
                         CHAT_MAX_FILE_BYTES=500000000

## Where things are
Design tokens ........ tailwind.config.ts, app/globals.css  (change the purple/orange here)
Sidebar layout ....... components/Shell.tsx
Notifications ........ components/NotificationsContext.tsx (sounds, toasts), components/NotificationBell.tsx
Holiday data ......... lib/holidays.ts  (add a year block to extend)

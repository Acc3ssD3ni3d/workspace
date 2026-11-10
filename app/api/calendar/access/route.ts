import { guard, J } from "@/lib/http";
import { canEditOrgCalendar } from "@/lib/calendar-access";

// Tells the Calendar page whether the Organisation tab is editable.
export const GET = guard(async (_req, session) =>
  J({
    isAdmin: session.role === "admin",
    canEditOrg: await canEditOrgCalendar(session),
  }),
);

import { guard, J } from "@/lib/http";
import { Item } from "@/lib/models";

/* ==========================================================================
   SMART DRIVE STRUCTURE
   POST /api/files/structure

   Makes sure the signed-in user has a ready-made folder tree in My Drive:

     2026
       11 - November
       12 - December
     2027
       01 - January ... 12 - December

   - Current year: only the current month and the months after it.
   - Next year:    all 12 months.
   - Safe to call as often as needed (nothing is created twice).
   - A folder the user deleted (moved to Trash) is not created again.

   Returns the folders for the CURRENT month so the Drive page can open
   them automatically.
   ========================================================================== */
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const monthFolderName = (index: number) =>
  `${String(index + 1).padStart(2, "0")} - ${MONTHS[index]}`;

// One run at a time per user, so two quick requests cannot create duplicates.
const running = new Map<string, Promise<any>>();

async function ensureFolder(owner: string, parent: string | null, name: string) {
  const existing: any = await Item.findOne({ owner, parent, type: "folder", name })
    .select("_id name trashed")
    .lean();

  if (existing) return existing.trashed ? null : existing;

  return Item.create({
    name, type: "folder", parent, owner, storageProvider: "local", trashed: false,
  });
}

async function build(owner: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let current: { year: any; month: any } = { year: null, month: null };

  for (const y of [year, year + 1]) {
    const yearFolder: any = await ensureFolder(owner, null, String(y));
    if (!yearFolder) continue;

    const firstMonth = y === year ? month : 0;

    for (let m = firstMonth; m < 12; m++) {
      const monthFolder: any = await ensureFolder(owner, String(yearFolder._id), monthFolderName(m));

      if (y === year && m === month && monthFolder) {
        current = {
          year: { _id: String(yearFolder._id), name: yearFolder.name, type: "folder", size: 0, uploaded: 0 },
          month: { _id: String(monthFolder._id), name: monthFolder.name, type: "folder", size: 0, uploaded: 0 },
        };
      }
    }
  }

  return current;
}

export const POST = guard(async (_req, s) => {
  const key = String(s.sub);

  if (!running.has(key)) {
    const job = build(key).finally(() => running.delete(key));
    running.set(key, job);
  }

  return J(await running.get(key));
});

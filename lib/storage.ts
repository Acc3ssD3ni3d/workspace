import fs from "fs";
import path from "path";
export const ROOT = path.resolve(process.env.STORAGE_DIR || ".storage");
// Disk name = Mongo id only (24 hex chars): no user input ever reaches the path
export const diskPath = (id: string) => { if (!/^[a-f0-9]{24}$/.test(id)) throw new Error("Bad id"); return path.join(ROOT, "storage", id); };
export const ensureDirs = () => fs.mkdirSync(path.join(ROOT, "storage"), { recursive: true });

// Run daily from cron: removes uploads abandoned for 24h+
import fs from "fs";
import { connectDB } from "../lib/db";
import { Item, mongoose } from "../lib/models";
import { diskPath } from "../lib/storage";
(async () => {
  await connectDB();
  const stale = await Item.find({ type: "file", $expr: { $lt: ["$uploaded", "$size"] }, createdAt: { $lt: new Date(Date.now() - 864e5) } });
  for (const it of stale) { await fs.promises.rm(diskPath(String(it._id)), { force: true }); await it.deleteOne(); }
  console.log("Removed", stale.length, "abandoned uploads"); await mongoose.disconnect();
})();

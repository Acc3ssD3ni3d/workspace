// npm run seed — creates (or resets) the first admin: <SEED_ADMIN_LOCAL>@<WORKSPACE_DOMAIN>
import bcrypt from "bcryptjs";
import { connectDB } from "../lib/db";
import { User, mongoose } from "../lib/models";
(async () => {
  await connectDB();
  const email = `${process.env.SEED_ADMIN_LOCAL}@${process.env.WORKSPACE_DOMAIN}`;
  await User.findOneAndUpdate({ email }, { name: process.env.SEED_ADMIN_NAME, email, role: "admin", active: true, passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD!, 10) }, { upsert: true });
  console.log("Admin ready:", email); await mongoose.disconnect();
})();

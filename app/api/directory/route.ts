import { guard, J } from "@/lib/http";
import { User } from "@/lib/models";
export const GET = guard(async () => J(await User.find({ active: true }).select("name email").sort({ name: 1 })));

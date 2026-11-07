"use client";

/* ==========================================================================
   1. IMPORTS
   ========================================================================== */
import { createContext, useContext } from "react";

/* ==========================================================================
   2. TYPES
   ========================================================================== */
export type WorkspaceUser = {
  name: string;
  role: string;
};

/* ==========================================================================
   3. CONTEXT
   ========================================================================== */
const UserContext = createContext<WorkspaceUser | null>(null);

/* ==========================================================================
   4. PROVIDER (used once, inside Shell)
   ========================================================================== */
export function UserProvider({
  user,
  children,
}: {
  user: WorkspaceUser;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

/* ==========================================================================
   5. HOOK (used by any page inside Shell)
   Returns null outside Shell, so callers should treat null as "not admin".
   ========================================================================== */
export function useUser() {
  return useContext(UserContext);
}

import { createServerFn } from "@tanstack/react-start";
import { requireAccount } from "@/lib/require-account";
export const personalSaveEntitlement = createServerFn({ method: "GET" }).middleware([requireAccount]).handler(async ({ context }) => {
  const { setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "private, no-store");
  const { ownerHasPersonal } = await import("./entitlements.server");
  return { personal: await ownerHasPersonal(context.userId) };
});

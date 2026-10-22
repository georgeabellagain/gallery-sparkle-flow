import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Called by a visitor's browser just after it records a visit; the server decides whether the owner hears of it. */
export const portfolioOpened = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().min(1).max(64), visitor: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const headers = getRequest()?.headers;
    const { notifyPortfolioOpened } = await import("./open-notify.server");
    try {
      await notifyPortfolioOpened({
        ...data,
        userAgent: headers?.get("user-agent") ?? null,
        country: headers?.get("cf-ipcountry") ?? null,
        authorization: headers?.get("authorization") ?? null,
      });
    } catch (error) {
      // A failed email never troubles the visitor.
      console.error("[portfolio-opened]", error instanceof Error ? error.message : error);
    }
    return null;
  });

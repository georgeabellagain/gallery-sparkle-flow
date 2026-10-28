import { describe, expect, it } from "vitest";
import { MONTHLY_BILLING, YEARLY_BILLING, YEARLY_PER_MONTH } from "@/lib/portfolia/plans";

describe("Personal billing labels", () => {
  it("labels £3 as monthly billing", () => expect(MONTHLY_BILLING).toBe("£3/month, billed monthly"));
  it("labels £2.08 as the equivalent of £25 billed yearly", () => {
    expect(YEARLY_PER_MONTH).toBe("£2.08");
    expect(YEARLY_BILLING).toBe("£25 billed yearly (£2.08/month equivalent)");
  });
});

import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/pf/LegalPage";

export const Route = createFileRoute("/refund")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Refund Policy — Portfolia" },
      {
        name: "description",
        content:
          "Portfolia offers a 30-day money-back guarantee on the Personal plan. Here's how to request a refund.",
      },
      { property: "og:title", content: "Refund Policy — Portfolia" },
      {
        property: "og:description",
        content:
          "Portfolia offers a 30-day money-back guarantee on the Personal plan. Here's how to request a refund.",
      },
    ],
    links: [{ rel: "canonical", href: "https://portfolia.site/refund" }],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <LegalPage>
      <h1 className="display-title text-3xl">Refund Policy</h1>
      <p className="text-xs text-muted-foreground">Last updated 29 September 2026</p>

      <h2>30-day money-back guarantee</h2>
      <p>
        If you’re not satisfied with your Portfolia Personal plan subscription, you can
        request a full refund within 30 days of your payment date. This applies to your
        first payment and to renewal payments alike.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Refunds are processed by our payment provider, Paddle. To request one, visit{" "}
        <a href="https://paddle.net">paddle.net</a> or email{" "}
        <a href="mailto:hello@portfolia.site">hello@portfolia.site</a> with the email
        address on your subscription, and we’ll help you through it. Paddle may ask for
        your order reference.
      </p>

      <h2>After the 30 days</h2>
      <p>
        You can cancel your subscription at any time from your dashboard. Cancelling
        stops future charges: your access continues until the end of the period you’ve
        already paid for, your portfolios keep their existing links, and your
        personalised address is kept for a further 30 days. Nothing is deleted when you
        cancel.
      </p>

      <h2>Refund timing</h2>
      <p>
        Approved refunds are returned to your original payment method. How quickly they
        appear depends on your bank or card provider.
      </p>

      <h2>Paddle’s refund policy</h2>
      <p>
        Because Paddle is the Merchant of Record for your order, Paddle’s refund policy
        at <a href="https://www.paddle.com/legal/refund-policy">paddle.com/legal/refund-policy</a>{" "}
        also applies.
      </p>
    </LegalPage>
  );
}

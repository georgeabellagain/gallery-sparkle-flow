import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/pf/LegalPage";

export const Route = createFileRoute("/terms")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Terms of Service — Portfolia" },
      {
        name: "description",
        content:
          "The terms that apply when you use Portfolia to host and share your PDF portfolio.",
      },
      { property: "og:title", content: "Terms of Service — Portfolia" },
      {
        property: "og:description",
        content:
          "The terms that apply when you use Portfolia to host and share your PDF portfolio.",
      },
    ],
    links: [{ rel: "canonical", href: "https://portfolia.site/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage>
      <h1 className="display-title text-3xl">Terms of Service</h1>
      <p className="text-xs text-muted-foreground">Last updated 29 September 2026</p>

      <h2>Who you are contracting with</h2>
      <p>
        Portfolia is provided by <strong>George Bell</strong> (“Portfolia”, “we”, “us”),
        operating the service at portfolia.site. “You” means the person who creates an
        account or uses the service. If you use Portfolia on behalf of an organisation,
        you confirm you have authority to bind that organisation to these terms.
      </p>

      <h2>Acceptance</h2>
      <p>
        By creating an account or using Portfolia you agree to these terms. If you don’t
        agree with them, please don’t use the service.
      </p>

      <h2>The service</h2>
      <p>
        Portfolia hosts the PDF portfolio you upload, together with the profile details,
        photo, banner and CV you choose to add, and gives your portfolio a shareable
        link. Features vary between the Free and Personal plans, as described in the app.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Keep your password confidential. You are responsible for activity under your account.</li>
        <li>Give accurate information and keep it up to date.</li>
        <li>You must be old enough to form a binding contract in your country.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You keep all ownership of the PDFs, images, text and details you upload. You
        grant us a limited licence to store, process and display your content for the
        sole purpose of operating the service — for example, showing your portfolio at
        your link. Don’t upload anything you don’t have the rights to share.
      </p>

      <h2>Acceptable use</h2>
      <p>You must not misuse the service, including by:</p>
      <ul>
        <li>using it unlawfully, or for fraud or spam;</li>
        <li>infringing other people’s intellectual property;</li>
        <li>interfering with its security — for example introducing malware, probing or scanning for vulnerabilities, or scraping the service;</li>
        <li>reverse engineering the service, reselling or redistributing it, or circumventing its technical limits.</li>
      </ul>

      <h2>Our intellectual property</h2>
      <p>
        The Portfolia software, design, brand and documentation belong to George Bell.
        These terms don’t give you any rights in them beyond the right to use the
        service.
      </p>

      <h2>Payment and subscription</h2>
      <p>
        The Personal plan costs £3 per month or £25 per year, billed in advance. Your
        subscription renews automatically until cancelled. You can cancel at any time
        from your dashboard: access continues until the end of the paid period, your
        portfolios keep their existing links, and your personalised address is kept for
        a further 30 days. Nothing is deleted when you cancel.
      </p>
      <p>
        Payments, billing, tax, cancellation and refund mechanics are handled by our
        payment provider, Paddle. The Paddle Buyer Terms at{" "}
        <a href="https://www.paddle.com/legal/checkout-buyer-terms">paddle.com/legal/checkout-buyer-terms</a>{" "}
        also apply to your purchase.
      </p>

      <h2>Merchant of record</h2>
      <p>
        Our order process is conducted by our online reseller Paddle.com. Paddle.com is
        the Merchant of Record for all our orders. Paddle provides all customer service
        inquiries and handles returns.
      </p>


      <h2>Service level and warranties</h2>
      <p>
        Portfolia is provided “as is”. We don’t guarantee that the service will be
        uninterrupted or error-free, and we disclaim all implied warranties
        (merchantability and fitness for a particular purpose) to the fullest extent
        permitted by law.
      </p>

      <h2>Suspension and termination</h2>
      <p>
        We may suspend or end access to an account for: material breach of these terms,
        non-payment, a security or fraud risk, or repeated or serious policy violations.
        Where possible we’ll give you reasonable notice and a chance to fix the issue.
        You may stop using Portfolia at any time. When an account is closed, its content
        is deleted or anonymised once it is no longer needed.
      </p>

      <h2>Liability</h2>
      <p>
        We are not liable for indirect, consequential or special damages, including loss
        of profits, data or goodwill. Our total liability to you is capped at the fees
        you paid in the 12 months before the claim. Nothing in these terms excludes
        liability for fraud, death or personal injury where the law doesn’t allow that.
      </p>

      <h2>Your indemnity</h2>
      <p>
        You agree to cover us against claims arising from your content, your unlawful
        use of the service, or your breach of these terms.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. Material changes will be announced in the app, and
        continued use after that counts as acceptance.
      </p>

      <h2>Governing law and disputes</h2>
      <p>
        These terms are governed by the laws of England and Wales, and the courts of
        England and Wales have exclusive jurisdiction over any dispute.
      </p>

      <h2>Assignment</h2>
      <p>
        You can’t transfer your account to someone else without our consent. We may
        transfer our rights and obligations as part of a merger or acquisition.
      </p>

      <h2>Force majeure</h2>
      <p>
        We aren’t liable for delays or failures caused by events beyond our reasonable
        control.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href="mailto:hello@portfolia.site">hello@portfolia.site</a>.
      </p>
    </LegalPage>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/pf/LegalPage";
import { openCookieSettings } from "@/lib/ads-consent";

export const Route = createFileRoute("/privacy")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Privacy Notice — Portfolia" },
      {
        name: "description",
        content:
          "How Portfolia collects, uses and protects your personal data, and your rights over it.",
      },
      { property: "og:title", content: "Privacy Notice — Portfolia" },
      {
        property: "og:description",
        content:
          "How Portfolia collects, uses and protects your personal data, and your rights over it.",
      },
    ],
    links: [{ rel: "canonical", href: "https://portfolia.site/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage>
      <h1 className="display-title text-3xl">Privacy Notice</h1>
      <p className="text-xs text-muted-foreground">Last updated 18 October 2026</p>

      <p>
        This notice explains how personal data is handled when you use Portfolia at
        portfolia.site. Portfolia is operated by <strong>George Bell</strong>, trading
        as Portfolia, who is the data controller for this information. Postal address:
        33 Gautrey Road, Peckham, London SE15. Email:{" "}
        <a href="mailto:hello@portfolia.site">hello@portfolia.site</a>.
      </p>

      <h2>Age</h2>
      <p>
        Portfolia is not intended for children. You must be at least 13 to create an
        account, and if you are under 18 you need permission from a parent or guardian.
        If we learn that an account belongs to a child under 13, we will delete it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your email address and password (stored only
          as a password hash), and your name if you choose to give it.
        </li>
        <li>
          <strong>Portfolio content:</strong> the PDF you upload, the profile details
          you publish (name, title, intro, links), your profile photo and banner, and a
          CV if you upload one.
        </li>
        <li>
          <strong>Usage data:</strong> visit counts, estimated unique visitors, download
          clicks, a random visitor identifier stored in your browser, IP address, and device and browser information.
        </li>
        <li>
          <strong>Support messages:</strong> anything you send us when asking for help.
        </li>
      </ul>

      <h2>How we use it</h2>
      <table>
        <thead>
          <tr>
            <th className="text-xs font-medium text-muted-foreground">Purpose</th>
            <th className="text-xs font-medium text-muted-foreground">Legal basis</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Hosting and displaying your portfolio, and keeping the service running</td>
            <td>Performing our contract with you</td>
          </tr>
          <tr>
            <td>Keeping accounts secure, preventing fraud and abuse</td>
            <td>Our legitimate interests</td>
          </tr>
          <tr>
            <td>Understanding how the service is used so we can improve it</td>
            <td>Our legitimate interests</td>
          </tr>
          <tr>
            <td>Answering support requests</td>
            <td>Contract performance / our legitimate interests</td>
          </tr>
          <tr>
            <td>Billing, invoicing and tax compliance</td>
            <td>Contract performance / legal obligation</td>
          </tr>
          <tr>
            <td>Marketing emails, if you opt in to any</td>
            <td>Consent (you can withdraw it at any time)</td>
          </tr>
        </tbody>
      </table>

      <p>Optional portfolio passwords are stored as salted hashes. Access cookies remember an unlocked portfolio for up to twelve hours, bounded by its expiry. Short-lived hashed network identifiers are used to limit repeated password attempts. The PDF checker processes the selected file on your device without uploading it.</p>

      <p>If a portfolio owner on the Personal plan turns on “Email me when someone opens it”, opening their published portfolio sends them an email saying when it was opened, the country your network reports and whether you used a phone, tablet or computer. Your IP address, name and visitor identifier are not included, and we keep only a count of opens and when the last email was sent, so the owner gets at most one email every few hours.</p>

      <h2>Where your data lives</h2>
      <p>
        Unsaved previews are kept in your browser. When you sign in and save, portfolio files and details are synced to your account in private cloud storage, with a browser cache for editing. Publishing permits visitor access through the portfolio link, subject to any password or expiry you set. Sign-in and billing information is also stored online by our service providers.
      </p>

      <h2>Who we share it with</h2>
      <ul>
        <li>
          <strong>Lovable</strong> — builds and hosts the website, and provides basic
          visitor statistics for the site.
        </li>
        <li>
          <strong>Supabase</strong> (through Lovable Cloud) — stores accounts, sign-in
          details, portfolio details and uploaded files.
        </li>
        <li>
          <strong>Cloudflare</strong> — delivers the website, runs its server code and
          protects it from attacks; it processes IP addresses and request details.
        </li>
        <li>
          <strong>Paddle.com, our Merchant of Record</strong> — it processes payments,
          subscriptions, tax compliance and invoicing for the Personal plan.
        </li>
        <li>
          <strong>Google</strong> — its favicon service shows the small icons next to
          website links on portfolios, and receives the linked website address and the
          visitor’s IP address when an icon loads. Google sign-in is used if you choose it.
        </li>
        <li><strong>Professional advisers</strong> such as lawyers and accountants, where needed.</li>
        <li><strong>Authorities</strong>, where we are legally required to.</li>
      </ul>
      <p>We never sell your personal data.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data for as long as your account is active, and delete it or
        anonymise it when it’s no longer needed. If you delete your account, your
        personal data is removed except where we must keep billing records for tax or
        legal reasons.
      </p>

      <h2>Security</h2>
      <p>
        We use appropriate technical and organisational measures to protect your data,
        including encryption in transit and access controls that limit who can see it.
      </p>

      <h2>Cookies</h2>
      <p>
        Portfolia uses cookies and browser storage to keep
        you signed in, remember your work and retain access to a portfolio you have unlocked. A random identifier in browser storage helps estimate unique portfolio visitors; it does not identify you by name. Our hosting provider may also set a small number of cookies and load a script that counts site visits in aggregate; these do not build a profile of you or track you across other websites. You can clear cookies and site data in your browser settings at any
        time.
      </p>
      <h3>Google Ads measurement</h3>
      <p>
        We advertise Portfolia on Google. To see whether those ads lead to people signing up or upgrading to
        Personal, our site can load Google’s ads tag, which sets cookies and tells Google when a sign-up or a
        Personal subscription happens (with the plan’s price and a reference, never your portfolio or its content).
        Google uses this under its own terms and may link it to its records of the ad you clicked.
      </p>
      <p>
        In the UK, the European Economic Area, Switzerland and Canada this only happens if you choose Accept in the
        cookie banner; if you choose Reject, or make no choice, nothing is sent and no Google advertising cookies are
        set. Elsewhere it is on by default. You can change your choice at any time with{" "}
        <button type="button" onClick={openCookieSettings} className="underline underline-offset-2">Cookie settings</button>,
        also linked at the foot of every page. Embedded portfolios on other websites never load it.
      </p>

      <h2>International transfers</h2>
      <p>
        Your data may be processed outside the UK and EEA, for example by our hosting
        and payment providers. Where that happens, it’s protected by an adequacy
        decision or standard contractual clauses.
      </p>

      <h2>Your rights</h2>
      <p>
        Under UK data protection law you can ask us to: give you a copy of your data
        (access); correct it; delete it; restrict how it’s used; move it to another
        service (portability); or stop certain uses (objection). You can also withdraw
        consent you’ve given. Email{" "}
        <a href="mailto:hello@portfolia.site">hello@portfolia.site</a> and we’ll respond
        within one month. You can also complain to the UK Information Commissioner’s
        Office at ico.org.uk.
      </p>

      <h2>Changes to this notice</h2>
      <p>If this notice changes, we’ll update it on this page.</p>
    </LegalPage>
  );
}

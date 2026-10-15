# Interaction audit — 15 October 2026

This is a broad functional audit, not a claim that every configuration, device, or failure condition has passed. Live checks used Chrome at portfolia.site, first signed out and then signed in through Google. A generated six-page PDF was used in a separate portfolio named **Interaction audit**. Existing published portfolios were not edited. The test portfolio was published briefly for sharing checks, then unpublished and retained as a draft.

## Browser results

| Area | Actions and observed result | Status |
| --- | --- | --- |
| Homepage | Help opens About; Close dismisses it. All seven feature tabs select their corresponding panel. | Passed |
| Pricing | Header pricing link opens pricing. Choose Personal opens upgrade dialog; upload prerequisite returns to upload area. | Passed for entry flow; checkout untested |
| Footer About | /#about opens the About dialog, including when arriving from pricing. | Passed |
| PDF upload | File chooser accepts generated PDF and opens editor with six pages. Processing was slow in this browser. | Passed; performance observation |
| Editor widget | Upload, Customise and Share controls present. Customise sections, back and close navigation respond. More options expands. | Passed for tested navigation |
| Portfolio name | Changing name updates editor title; survives navigation/reload and appears on signed-in dashboard. | Passed |
| Background | Warm wood selection reveals background controls. Other presets are listed. | Partial; all presets and image uploads not exercised |
| Lighting and paper | Enabling Studio makes appearance controls available; matte/satin, brightness, top light, diffusion and environments listed. | Controls inspected; visual changes unverified |
| Scrapbook | Added sticky note with text, page tab named Contact with Handwritten font and page 3 destination, and website link. Save closes dialog and item counts update. | Passed for editing/save; 3D interaction unverified |
| Profile | Name validation prevents incomplete publish. Title/introduction updates appear in creator preview Profile overlay; overlay opens/closes. | Passed; photo/CV uploads and all styling not exercised |
| Projects | Add project, name it, set pages 1–3, save; success message and Projects viewer control appear. Selector opens and project selection closes it. | Passed; deep-link destination not independently verified |
| Page-by-page reader | Next/previous change visible page; thumbnails jump to page 6; next is disabled at end. | Passed |
| Scroll reader | Selecting Scroll loads all six page text groups and loader clears. | Passed |
| Zoom | Zoom in changes 100% to 125%; Reset restores 100%. | Passed for buttons; cursor anchoring/panning untested |
| Full screen | Full screen becomes Exit full screen and exit restores editor. | Passed for app fallback; native browser full screen unverified |
| PDF download | Download event completed with a saved file. File & publishing download checkbox removes/restores link. | Passed |
| Loading | Loading portfolio status visible during opening and clears after load. | Passed for observed flows |
| Draft publishing | Missing name routes to profile form; signed-out publish leads to sign-in. | Passed |
| Google sign-in | Continue with Google reaches provider; user completed sign-in; dashboard shows authenticated controls. | Passed |
| Forgot password | Empty-email action displays Enter your email above first. | Passed for validation; email delivery untested |
| Dashboard | Draft opens in editor with Saved status; name and six-page file preserved. | Passed |
| Publish/unpublish | Publish enables public sharing; Unpublish opens confirmation and confirmed action returns draft with sharing disabled. Dashboard confirms Draft. | Passed |
| Share link | Copy link writes exact /p/gu3wz address to clipboard and reports success. | Passed |
| QR code | Dialog displays QR image and permanent share address. | Passed for display |
| QR PNG export | Clicked Download high-resolution PNG; no download event arrived within 10 seconds, and no app error appeared. | Unverified; investigate on another browser before calling a product bug |
| Embed | Dialog loads embedded portfolio, produces expected iframe code; Copy embed code writes it to clipboard. | Passed; third-party hosting installation untested |
| Statistics | 7 days selects pressed state; counting explanation expands. | Passed for UI; aggregation correctness not independently measured |

## Automated and source checks

- Full suite: `node --import tsx --test tests/*.test.ts`: **141 passed, 0 failed**.
- First run exposed one outdated expectation: Personal canonical was still expected to be a named address after personalised addresses were paused. Updated the test to expect the permanent `/p/book` canonical; no production behavior changed for this audit.
- Source scan compared 67 literal internal href/to destinations with 47 registered file routes: no unmatched internal route found. This does not establish that all destinations were clicked, that dynamic URLs are correct, or that external services work.

## Remaining coverage

The browser reports WebGL disabled and the app falls back with “3D is unavailable on this device.” Studio lighting, page curls, sticky-note occlusion, drag interactions, frame rate and GPU performance therefore require a GPU-enabled browser. No positive visual pass is claimed for those features.

Also outstanding: mobile/touch and other browsers, keyboard navigation, wheel cursor anchoring and panning, all styling/slider combinations, large/corrupt/encrypted PDF boundaries, replacement upload, profile photo/CV upload, password/expiry protection, social cover changes, project deep links, payment/billing changes, account creation/reset delivery/sign-out, deletion, feedback submission, exhaustive marketing-page clicks and third-party embed installation. Destructive actions, payments and messages were not submitted for this audit.

The main signed-out and signed-in creation/sharing paths worked in this session. The QR export result and the untested areas above prevent an “every feature passes” conclusion.

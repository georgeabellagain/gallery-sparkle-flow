import type { SeoContent } from '@/components/pf/SeoLanding';
export type Profession = 'architecture' | 'graphic-design' | 'photography' | 'fashion';
export interface ProfessionGuide {
  kind: Profession;
  title: string;
  description: string;
  exampleTitle: string;
  exampleDescription: string;
  disclosure: string;
  sections: { title: string; body: string }[];
  checklist: string[];
  faqs: { q: string; a: string }[];
}
export const PROFESSION_GUIDES: Record<string, ProfessionGuide> = {
  '/architecture-portfolio': {
    kind: 'architecture', title: 'Architecture Portfolio Flipbook — Share Plans & Projects | Portfolia',
    description: 'Share your architecture PDF as an online flipbook. Explore a pavilion portfolio example, organise named projects and send practices a direct link. Free to start.',
    exampleTitle: 'A place to pause', exampleDescription: 'A six-page pavilion study: brief, plan, section, materials and reflection. Try the Projects menu to move between parts of the story.',
    disclosure: 'Original fictional demonstration by Portfolia. Schematic drawings; not a built project or construction guidance.',
    sections: [
      { title: 'Build a clear project story', body: 'An architecture portfolio needs to make both the proposal and your contribution understandable. Introduce each project with its brief, context and your role, then choose drawings that explain the important decisions. A plan can establish organisation; a section can explain volume, daylight and relationships. For collaborative work, identify which drawings and stages you contributed to and credit the rest of the team. A small, considered selection is easier to discuss than an unexplained collection of sheets.' },
      { title: 'Check drawings at the size people will read', body: 'Export embedded fonts and retain vector linework where your authoring software allows it. Test scale bars, legends and drawing labels on a laptop and phone: a legible print sheet can become difficult to read on a small screen. Use page-by-page reading for a single drawing or the flipbook for a composed sequence. Portfolia preserves the PDF layout, but it cannot recover detail that was removed during export. Check the published reader before sending an application.' },
      { title: 'Send a practice straight to relevant work', body: 'Name the projects in the editor and assign their PDF page ranges. You can then copy a link that opens at a particular housing, landscape or civic project while leaving the rest of the portfolio available. Keep your introduction and CV relevant to the application. If a practice requests a file rather than a link, follow that requirement; you can also permit PDF downloads. Personal offers larger uploads and password or expiry settings for work you are authorised to share.' },
    ],
    checklist: ['Identify the brief, date and your role.', 'Keep plan and section labels readable.', 'Credit collaborators and image sources.', 'Test project links and optional PDF downloads.'],
    faqs: [{ q: 'Can I link directly to an architecture project?', a: 'Yes. Add a named project and its page range in the editor, save it, then copy its project link. The link opens at its first page; the full portfolio remains available.' }, { q: 'Should I export pages or spreads?', a: 'Choose the layout that matches your intended reading experience, then test it in the viewer. A spread exported as one PDF page counts as one page when setting project ranges. Keep small drawing labels readable at screen size.' }],
  },
  '/graphic-design-portfolio': {
    kind: 'graphic-design', title: 'Graphic Design Portfolio Flipbook — Branding & Editorial | Portfolia',
    description: 'Turn your graphic design PDF into a shareable portfolio flipbook. Explore an identity example, keep your layouts and link directly to named projects. Start free.',
    exampleTitle: 'Fieldnotes', exampleDescription: 'A six-page identity study for a fictional journal, from the brief and mark to typography and editorial applications.',
    disclosure: 'Original fictional demonstration by Portfolia. Fieldnotes is an invented brief, not a customer or client project.',
    sections: [
      { title: 'Show the system behind the finished image', body: 'A branding portfolio can explain how an identity works across a mark, typography, colour and applications. Start with the problem and audience, then show the decisions that connect those parts. An editorial project might focus on hierarchy, grids and sequencing; a campaign might show how a central idea adapts across formats. Give each project a short explanation of your role. Label self-initiated concepts honestly, and use outcomes or client results only when you can substantiate them.' },
      { title: 'Keep control of typography and composition', body: 'Your PDF carries the page design you already made. Export fonts correctly, inspect fine type at reading size and check that mockup images remain clear without making the file unnecessarily large. The flipbook presents rendered pages in your chosen sequence. Scroll and Page by page also support selectable text and external PDF links. If a case study depends on an interactive prototype or live website, tell the reader where to find it and test the link in one of those modes.' },
      { title: 'Make a varied portfolio easy to browse', body: 'Use named projects for identity, packaging, editorial and digital work. The visual contents panel gives a visitor a first-page preview of each project, and direct links let you highlight the relevant part in a studio application. The page ranges are navigation aids: they do not remove work from the PDF or create separate editions. Replace your portfolio as it develops using the same public address, then recreate project ranges to match the new document.' },
    ],
    checklist: ['Explain the brief and your contribution.', 'Show a visual system across useful applications.', 'Embed fonts and inspect small typography.', 'Test external links in Scroll or Page by page.'],
    faqs: [{ q: 'Will my PDF links work in the flipbook?', a: 'External PDF links work in Scroll and Page by page. They are not clickable within the flipbook, so offer another reading mode when linking to live projects or prototypes matters.' }, { q: 'Can I separate branding and editorial projects?', a: 'Yes. Named projects organise page ranges within one PDF and give each range a direct link. They do not create separate PDFs or hide the other projects.' }],
  },
  '/photography-portfolio': {
    kind: 'photography', title: 'Photography Portfolio Flipbook — Share Your Photo Series | Portfolia',
    description: 'Present a photography PDF as a clean online flipbook. Explore a sample sequence, group named series and share one link with editors and clients. Free to start.',
    exampleTitle: 'Quiet coast', exampleDescription: 'A six-page demonstration of photographic sequencing: an opening view, a close detail and a quieter closing frame.',
    disclosure: 'Fictional demonstration with AI-generated coastal imagery. Not a real shoot, customer portfolio or photographer’s commissioned work.',
    sections: [
      { title: 'Let the sequence communicate your point of view', body: 'A photography portfolio is also an edit. Think about the relationship between the opening frame, the images that develop the series and the final impression. Changes in distance, light or scale can help the sequence breathe. Add captions where a location, commission or context matters, and distinguish personal work from commissioned work. The sample here illustrates pacing with generated imagery; your own portfolio should represent your photographs and the authorship you can claim.' },
      { title: 'Balance detail with a manageable file', body: 'Export a screen-ready PDF and inspect it at a realistic viewing size before uploading. Over-compressing photographs can lose texture and create visible artefacts, while oversized source images can slow the first visit. Free accepts one PDF up to 10 MB; Personal accepts up to 50 MB per portfolio. Use the local PDF checker to review size and page structure. Portfolia displays your uploaded PDF and cannot restore resolution or tonal information that was discarded during export.' },
      { title: 'Give each series its own point of entry', body: 'Name your projects by series or subject, such as interiors, portraiture or landscape. Each project can open from its own link, making it easier to direct an editor or client to relevant work. Keep contact information and commissioning details in your profile. You choose whether the PDF download button is available. Password and expiry settings on Personal can control access to a private viewing link, but they cannot prevent a viewer from capturing or retaining material they have already seen.' },
    ],
    checklist: ['Choose a deliberate opening and closing image.', 'Use accurate captions and authorship credits.', 'Check image quality against the upload limit.', 'Make contact and commissioning details easy to find.'],
    faqs: [{ q: 'Can I keep different photographic series in one portfolio?', a: 'Yes. Give each series a named page range and share its direct project link. Visitors can still browse the rest of the PDF.' }, { q: 'Does disabling downloads stop images being copied?', a: 'No. It removes the PDF download control, but it cannot prevent screenshots or other copies of material a visitor can view.' }],
  },
  '/fashion-portfolio': {
    kind: 'fashion', title: 'Fashion Portfolio & Lookbook Flipbook — Share Your PDF | Portfolia',
    description: 'Share your fashion portfolio or lookbook as an online flipbook. Explore Scarlett Bushell’s example and organise collections into named projects. Free to start.',
    exampleTitle: 'Scarlett Bushell’s lookbook', exampleDescription: 'Explore the owner-selected fashion lookbook using its saved presentation settings, with Simple and Studio views.',
    disclosure: 'Property of Scarlett Bushell 2026',
    sections: [
      { title: 'Connect the collection to its development', body: 'A fashion portfolio can bring together research, silhouette exploration, textile experiments, flats and final imagery. Choose the stages that explain the collection, rather than treating every process image as equally important. A lookbook may focus more closely on the finished looks; a design application may need more evidence of development and construction. Identify your role and credit photographers, stylists, models and collaborators where relevant. Keep the project description close to the work it explains.' },
      { title: 'Give fabric and garment details enough space', body: 'Check that colour, surface texture and construction details remain legible in the exported PDF. A large editorial image can establish a look, while a focused detail can show a finish or material choice. The Studio viewer offers a physical booklet presentation; Simple provides a clean alternative. Try both on your own pages and inspect the result on a phone. Lighting and page finishes are presentation choices, so choose settings that let the work remain readable.' },
      { title: 'Share a collection wherever it is encountered', body: 'Use named projects to group collections or briefs into clear page ranges, then send a direct link to the relevant collection. A QR code can connect a printed show card or graduate display with your published portfolio. Use the embed option to place the reader within an existing website. Before sharing an application, check its submission rules and include a PDF where one is specifically requested. Personal supports multiple separate portfolios if you need distinct published lookbooks.' },
    ],
    checklist: ['Show the development appropriate to the brief.', 'Make fabric and garment details readable.', 'Credit the team behind final imagery.', 'Test your collection links and printed QR code.'],
    faqs: [{ q: 'Can I name individual collections within a lookbook?', a: 'Yes. Add named projects with PDF page ranges in the editor. Each collection gets a stable direct link, and renaming it does not break that link.' }, { q: 'Can I show a fashion flipbook on my existing website?', a: 'Yes. Published portfolios include an embed option on Free and Personal. Follow the guide for your website platform and check the result on mobile.' }],
  },
};
export function withProfessionContent(c: SeoContent): SeoContent {
  const guide=PROFESSION_GUIDES[c.path];
  return guide ? { ...c, title:guide.title, description:guide.description, faqs:[...guide.faqs,...c.faqs] } : c;
}

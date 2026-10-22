import pages from "./content/site-pages.json" with { type: "json" };

export const SITE_URL = process.env.MAHODAYSOLAR_SITE_URL ?? "https://mahodaysolar.com";
export const LAST_REVIEWED = "2026-10-22";

/** The site build is a draft PR and noindex until the founder launches it. */
export const PAGE_STATUS = "launch-gated" as const;

export interface PageRef {
  slug: string;
  kind: "service" | "guide";
  title: string;
  summary: string;
  path: string;
  url: string;
  status: typeof PAGE_STATUS;
}

export const pageIndex: PageRef[] = [
  ...pages.services.map((s) => ({ slug: s.slug, kind: "service" as const, title: s.name, summary: s.summary, path: s.path, url: `${SITE_URL}${s.path}`, status: PAGE_STATUS })),
  ...pages.guides.map((g) => ({ slug: g.slug, kind: "guide" as const, title: g.title, summary: g.description, path: g.path, url: `${SITE_URL}${g.path}`, status: PAGE_STATUS })),
];
export const pageBySlug = (slug: string) => pageIndex.find((p) => p.slug === slug);
export const serviceBySlug = (slug: string) => pages.services.find((s) => s.slug === slug);
export const serviceSlugs = pages.services.map((s) => s.slug);

/** Pages the research plans but the site has not built. Listed without URLs on purpose. */
export const plannedPages = [
  "solar-calculator", "pm-surya-ghar-subsidy (hub)", "net-metering", "solar-subsidy/<state>", "solar-loan",
  "solar-panel-warranty", "solar-installation-checklist", "solar-panel-maintenance-checklist",
] as const;

/**
 * Official pointers. These are the portals a reader should confirm against. The server has NOT
 * read them: no rate, cap, eligibility rule or step is stated anywhere in this package.
 */
export const officialSources = [
  { topic: "PM Surya Ghar application and status", url: "https://pmsuryaghar.gov.in", verified_by_server: false },
  { topic: "National rooftop solar portal", url: "https://solarrooftop.gov.in", verified_by_server: false },
  { topic: "MNRE grid-connected rooftop solar programme", url: "https://mnre.gov.in/en/grid-connected-solar-rooftop-programme/", verified_by_server: false },
  { topic: "PIB release on the scheme", url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2010133&reg=48&lang=2", verified_by_server: false },
] as const;

export const SOURCE_NOTE =
  "This server states no subsidy rate, cap, eligibility rule, tariff or application step. Read the current rules on the official portals listed. Your state nodal agency and electricity distribution company (DISCOM) hold the state-level and net-metering rules.";

export const checklists = {
  "amc-renewal": {
    title: "Before you renew a solar AMC",
    items: [
      "Is the renewal term, start date and end date written down, with no gap between the old and new cover?",
      "Does the scope list each inspection (panels, wiring, earthing, inverter, generation check) and each exclusion?",
      "Are parts and replacement labour included, excluded, or priced separately? Ask for it in writing.",
      "What is the response commitment when something fails, and what happens if it is missed?",
      "Is a written service report given after every visit?",
      "What happens to the cover if the system is modified, moved or has third-party repairs?",
      "How are cancellation and non-renewal handled, and is anything refundable?",
      "Do the manufacturer warranties stay valid under this provider's service work?",
    ],
  },
  "amc-quote-comparison": {
    title: "Comparing two solar AMC quotes: scope before price",
    items: [
      "Put both scopes side by side: visits per year, checks per visit, reporting.",
      "Check the same system size and the same inclusions are being priced.",
      "Confirm what is excluded in each (parts, inverter replacement, water access for cleaning, roof access).",
      "Ask each provider for a sample service report.",
      "Compare response commitments and how they are evidenced.",
      "Only then compare the price.",
    ],
  },
  "installation-acceptance": {
    title: "Buyer checklist at installation handover",
    items: [
      "Written system size and the panel and inverter make and model match the order.",
      "Mounting, wiring and earthing are neat and labelled; ask the installer to explain each.",
      "The inverter shows generation; you are shown how to read it and where alerts appear.",
      "You receive warranty documents, the single-line diagram and the commissioning record.",
      "Grid-connection and net-metering paperwork status is explained, with who files what.",
      "You know who to call for service and what the first maintenance visit covers.",
    ],
  },
  maintenance: {
    title: "Routine solar maintenance tasks",
    items: [
      "Panel surface cleaning, using methods safe for the glass and the roof.",
      "Visual check for cracks, hot spots, loose mounting and bird or debris build-up.",
      "Wiring, connectors, earthing and surge protection inspection by a qualified person.",
      "Inverter error-log review and ventilation check.",
      "Generation compared against what the system should be producing.",
    ],
  },
} as const;
export type ChecklistName = keyof typeof checklists;
export const checklistNames = Object.keys(checklists) as [ChecklistName, ...ChecklistName[]];

export const amcScope = {
  residential: ["Scheduled preventive visits", "Panel, wiring, earthing and mounting inspection", "Inverter health check and error-log review", "Generation check", "Written report after each visit"],
  "housing-society": ["Everything in residential", "Shared-meter and common-area considerations", "Roof access coordinated with the society committee", "Consolidated report for the committee"],
  commercial: ["Everything in residential", "Performance reporting against expected generation", "Thermal inspection where agreed", "Response and escalation terms written into the contract"],
} as const;
export type Segment = keyof typeof amcScope;

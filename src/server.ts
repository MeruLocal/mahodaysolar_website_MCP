import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { emi, sizeEstimate } from "./calc.js";
import {
  LAST_REVIEWED, PAGE_STATUS, SITE_URL, SOURCE_NOTE, amcScope, checklistNames, checklists, officialSources,
  pageBySlug, pageIndex, plannedPages, serviceBySlug, serviceSlugs, type Segment,
} from "./data.js";

export const SERVER_NAME = "mahodaysolar-mcp";
export const SERVER_VERSION = "0.1.0";

const INSTRUCTIONS = `Read-only knowledge and calculator server for Mahoday Solar (solar AMC, maintenance, cleaning, inverter repair, monitoring, installation; India first).

Rules to relay to the user:
- Calculators use only numbers the user supplies. They give no price, saving or payback.
- This server states NO subsidy rate, cap, eligibility rule, tariff or application step. subsidy_* and netmetering_* tools return pointers to official portals with status "unsourced". Tell the user to confirm on those portals.
- Page URLs are canonical but every page is status "launch-gated" until the site is live; planned pages have no URL.
- Business contact details and service area are unconfirmed unless business_get_info says otherwise.
- It cannot book, quote, submit forms or fetch other websites.

Start with site_search_pages, solar_calculate_size, amc_get_checklist or subsidy_get_overview.`;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const Cite = z.object({ title: z.string(), url: z.string().nullable(), status: z.string() });
const envelope = <T extends z.ZodRawShape>(data: T) => ({
  status: z.enum(["ok", "unsourced", "unconfirmed", "not_found"]),
  summary: z.string(),
  data: z.object(data),
  citations: z.array(Cite),
  last_reviewed: z.string(),
});
type Status = "ok" | "unsourced" | "unconfirmed" | "not_found";
type Citation = { title: string; url: string | null; status: string };

function reply<D extends Record<string, unknown>>(status: Status, summary: string, data: D, citations: Citation[] = []) {
  const payload = { status, summary, data, citations, last_reviewed: LAST_REVIEWED };
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
}
const cite = (slug: string): Citation[] => {
  const p = pageBySlug(slug);
  return p ? [{ title: p.title, url: `${p.url}?utm_source=mcp`, status: p.status }] : [];
};
const officialCites = (): Citation[] => officialSources.map((s) => ({ title: s.topic, url: s.url, status: "official-portal-not-read-by-server" }));

export interface BusinessEnv { [k: string]: string | undefined }
const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export function buildServer(env: BusinessEnv = process.env): { server: McpServer; toolNames: string[] } {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: INSTRUCTIONS });
  const toolNames: string[] = [];
  const tool = <I extends z.ZodRawShape, O extends z.ZodRawShape>(
    name: string, title: string, description: string, inputSchema: I, out: O,
    handler: (args: z.infer<z.ZodObject<I>>) => ReturnType<typeof reply>,
  ) => {
    toolNames.push(name);
    server.registerTool(name, { title, description, inputSchema, outputSchema: envelope(out), annotations: { title, ...READ_ONLY } },
      (async (args: unknown) => handler(args as z.infer<z.ZodObject<I>>)) as never);
  };

  // ---- calculators -------------------------------------------------------
  tool("solar_calculate_size", "Estimate rooftop solar system size",
    "Indicative system size from the user's own numbers: required kW, panel count and optional roof area. Requires the user's monthly kWh, their peak sun hours, a performance ratio and the panel wattage; the server supplies no defaults for any of them. Returns no price, saving or payback.",
    {
      monthly_kwh: z.number().positive().max(1_000_000).describe("Monthly electricity use in kWh, from the bill"),
      peak_sun_hours: z.number().min(1).max(12).describe("Peak sun hours per day for the site; the user supplies it from a source they trust"),
      performance_ratio: z.number().min(0.3).max(1).describe("System performance ratio as a fraction, e.g. what the installer quotes; user supplied"),
      panel_watt: z.number().min(100).max(1000).describe("Wattage of one panel, e.g. 550"),
      roof_m2_per_kw: z.number().positive().max(100).optional().describe("Roof area per kW as given by the installer; omit to skip roof area"),
    },
    { required_kw: z.number(), panel_count: z.number(), installed_kw_at_panel_count: z.number(), roof_area_m2: z.number().nullable(), formula: z.string() },
    (a) => reply("ok", "Indicative size from your inputs only; confirm with a site survey. No cost or saving is implied.", sizeEstimate(a), cite("solar-installation")));

  tool("loan_calculate_emi", "Calculate a solar loan EMI",
    "Standard EMI from the loan amount, annual interest rate and tenure the user enters. The server stores no lender rates.",
    {
      principal: z.number().positive().max(1e9).describe("Loan amount"),
      annual_rate_percent: z.number().min(0).max(60).describe("Annual interest rate in percent, from the lender"),
      tenure_months: z.number().int().min(1).max(480).describe("Tenure in months"),
    },
    { monthly_emi: z.number(), total_payable: z.number(), total_interest: z.number(), formula: z.string() },
    (a) => reply("ok", "EMI from your inputs only; lender fees and rate type are not modelled.", emi(a)));

  // ---- subsidy and net metering (pointers only) ---------------------------
  tool("subsidy_get_overview", "Where to confirm the rooftop solar subsidy",
    "Returns official portals for the PM Surya Ghar rooftop solar subsidy and the Mahoday Solar guide URL. States no rate, cap, eligibility or step: status is always 'unsourced'.",
    {},
    { official_sources: z.array(z.object({ topic: z.string(), url: z.string(), verified_by_server: z.boolean() })), note: z.string(), planned_pages: z.array(z.string()) },
    () => reply("unsourced", "No subsidy figure is stated here. Confirm on the official portals.",
      { official_sources: [...officialSources], note: SOURCE_NOTE, planned_pages: ["pm-surya-ghar-subsidy (hub)"] },
      [...cite("pm-surya-ghar-subsidy"), ...officialCites()]));

  tool("subsidy_get_state", "Find state subsidy information sources",
    "For an Indian state, says where state-level rules live. Returns no state rate or rule: status is always 'unsourced'. State pages are planned but not built.",
    { state: z.string().trim().min(2).max(40).regex(/^[A-Za-z .&-]+$/).describe("Indian state or union territory name, e.g. Gujarat") },
    { state: z.string(), where_to_look: z.array(z.string()), official_sources: z.array(z.object({ topic: z.string(), url: z.string() })) },
    (a) => reply("unsourced", "State rules are not held by this server.",
      {
        state: a.state,
        where_to_look: ["The state renewable energy / nodal agency website", "Your electricity distribution company (DISCOM) rooftop solar page", "The national portals below"],
        official_sources: officialSources.map((s) => ({ topic: s.topic, url: s.url })),
      }, officialCites()));

  tool("netmetering_get_guide", "Where to confirm net metering rules",
    "Net metering rules are set by each state regulator and DISCOM. Returns where to look and the Mahoday Solar guide status (page planned, no URL). States no rule or limit.",
    {},
    { where_to_look: z.array(z.string()), planned_pages: z.array(z.string()) },
    () => reply("unsourced", "Net metering terms are not held by this server.",
      { where_to_look: ["Your DISCOM's net metering application page", "Your state electricity regulatory commission's published regulations", "solarrooftop.gov.in"], planned_pages: ["net-metering"] },
      officialCites().filter((c) => c.url?.includes("solarrooftop"))));

  // ---- AMC ----------------------------------------------------------------
  tool("amc_get_scope", "What a solar AMC covers",
    "Typical scope of a solar annual maintenance contract for a residential, housing-society or commercial system. Qualitative only: no prices, visit counts or response times.",
    { segment: z.enum(["residential", "housing-society", "commercial"]).describe("Type of system owner") },
    { segment: z.string(), scope: z.array(z.string()) },
    (a) => reply("ok", "Typical scope; the contract you sign is what binds the provider.", { segment: a.segment, scope: [...amcScope[a.segment as Segment]] }, cite("solar-amc")));

  tool("amc_plan_visits", "Build an AMC visit task list",
    "Turns a system description into a task list and questions to put to a provider. Gives no frequencies, prices or response times because none are sourced; it tells the user what to ask for in writing.",
    {
      system_kw: z.number().positive().max(100_000).describe("System size in kW"),
      segment: z.enum(["residential", "housing-society", "commercial"]),
      dust_level: z.enum(["low", "medium", "high"]).describe("Self-assessed dust or soiling level at the site"),
      install_year: z.number().int().min(2000).max(2100).optional().describe("Year of installation, if known"),
    },
    { tasks: z.array(z.string()), ask_your_provider: z.array(z.string()), notes: z.array(z.string()) },
    (a) => {
      const notes = ["No visit frequency is stated: ask the provider to write the schedule into the contract."];
      if (a.dust_level === "high") notes.push("High dust: ask how cleaning is scheduled and who supplies water and roof access.");
      if (a.install_year !== undefined) notes.push("Check the manufacturer and installer warranty documents for terms that apply to a system of this age.");
      return reply("ok", "Task list for discussion with a provider.", {
        tasks: [...checklists.maintenance.items, ...amcScope[a.segment as Segment]],
        ask_your_provider: ["How many visits a year, and what is checked at each?", "What is the response commitment when something fails?", "What is excluded?", "Can I see a sample service report?"],
        notes,
      }, cite("solar-amc"));
    });

  tool("amc_get_checklist", "Get a solar checklist",
    "Returns one checklist: amc-renewal, amc-quote-comparison, installation-acceptance or maintenance.",
    { name: z.enum(checklistNames).describe("Which checklist") },
    { name: z.string(), title: z.string(), items: z.array(z.string()) },
    (a) => {
      const c = checklists[a.name];
      const slug = a.name === "amc-renewal" ? "solar-amc-renewal" : a.name === "amc-quote-comparison" ? "amc-vs-pay-per-visit" : a.name === "maintenance" ? "solar-panel-maintenance" : "solar-installation";
      return reply("ok", c.title, { name: a.name, title: c.title, items: [...c.items] }, cite(slug));
    });

  // ---- services and pages -------------------------------------------------
  tool("services_list_offered", "List Mahoday Solar services",
    "Services described on the Mahoday Solar site build. The owner has not yet confirmed which are offered where: treat as 'described', and use business_check_service_area.",
    {},
    { services: z.array(z.object({ slug: z.string(), name: z.string(), summary: z.string(), url: z.string() })) },
    () => reply("unconfirmed", "Services as described on the draft, launch-gated site. The owner has not confirmed which are offered.", {
      services: pageIndex.filter((p) => p.kind === "service").map((p) => ({ slug: p.slug, name: p.title, summary: p.summary, url: p.url })),
    }));

  tool("services_get_service", "Get one service in detail",
    "Inclusions, steps and FAQs for one service page, as published in the site build. FAQ answers are the site's text.",
    { slug: z.enum(serviceSlugs as [string, ...string[]]).describe("Service slug, e.g. solar-amc") },
    { name: z.string(), summary: z.string(), includes: z.array(z.string()), steps: z.array(z.object({ t: z.string(), d: z.string() })), faq: z.array(z.object({ q: z.string(), a: z.string() })) },
    (a) => {
      const s = serviceBySlug(a.slug)!;
      return reply("unconfirmed", `${s.summary} (Draft site copy; the owner has not confirmed this service or its terms.)`, { name: s.name, summary: s.summary, includes: s.includes, steps: s.steps, faq: s.faq }, cite(a.slug));
    });

  tool("site_search_pages", "Find a Mahoday Solar page to cite",
    "Keyword search over the titles and summaries of the published page index. Returns canonical URLs (status launch-gated) and lists planned pages that have no URL yet.",
    { query: z.string().trim().min(2).max(80).describe("Keyword, e.g. 'inverter' or 'subsidy'"), limit: z.number().int().min(1).max(20).default(5) },
    { matches: z.array(z.object({ title: z.string(), kind: z.string(), url: z.string(), status: z.string(), summary: z.string() })), planned_without_url: z.array(z.string()) },
    (a) => {
      const q = a.query.toLowerCase().split(/\s+/);
      const scored = pageIndex
        .map((p) => ({ p, s: q.filter((t) => `${p.title} ${p.summary} ${p.slug}`.toLowerCase().includes(t)).length }))
        .filter((x) => x.s > 0).sort((x, y) => y.s - x.s).slice(0, a.limit).map((x) => x.p);
      const planned = plannedPages.filter((p) => q.some((t) => p.includes(t)));
      return reply(scored.length || planned.length ? "ok" : "not_found",
        scored.length ? `${scored.length} page(s).` : "No built page matches. Try services_list_offered.",
        { matches: scored.map((p) => ({ title: p.title, kind: p.kind, url: `${p.url}?utm_source=mcp`, status: p.status, summary: p.summary })), planned_without_url: [...planned] },
        scored.map((p) => ({ title: p.title, url: `${p.url}?utm_source=mcp`, status: p.status })));
    });

  tool("system_compare_types", "Compare on-grid, off-grid and hybrid systems",
    "Plain-language differences between system types. Qualitative, no costs. A dedicated Mahoday Solar comparison page is planned and has no URL yet.",
    {},
    { types: z.array(z.object({ type: z.string(), what_it_is: z.string(), consider: z.string() })) },
    () => reply("unsourced", "General explainer without a cited source; ask an installer to size for your site.", {
      types: [
        { type: "on-grid", what_it_is: "Connected to the electricity grid and typically depends on net metering arrangements.", consider: "Usually stops exporting during a grid outage unless designed otherwise; confirm with your DISCOM." },
        { type: "off-grid", what_it_is: "Not connected to the grid; usually paired with storage or a matched load.", consider: "Any storage adds maintenance and replacement planning." },
        { type: "hybrid", what_it_is: "Grid-connected with battery backup.", consider: "More components to maintain; ask which loads are backed up." },
      ],
    }));

  // ---- business -----------------------------------------------------------
  tool("business_get_info", "Mahoday Solar contact details",
    "Contact details the owner has confirmed. Returns only fields that are set; if none are set the status is 'unconfirmed' and the only contact path is the website form.",
    {},
    { contact: z.record(z.string(), z.string()), website_contact_url: z.string() },
    () => {
      const contact: Record<string, string> = {};
      for (const [k, v] of Object.entries({ phone: env.MAHODAYSOLAR_PHONE, email: env.MAHODAYSOLAR_EMAIL, address: env.MAHODAYSOLAR_ADDRESS, legal_entity: env.MAHODAYSOLAR_LEGAL_ENTITY })) {
        const c = clean(v); if (c) contact[k] = c;
      }
      return reply(Object.keys(contact).length ? "ok" : "unconfirmed",
        Object.keys(contact).length ? "Owner-confirmed details." : "No contact details are confirmed yet; use the website form once the site is live.",
        { contact, website_contact_url: `${SITE_URL}/contact?utm_source=mcp` }, [{ title: "Contact", url: `${SITE_URL}/contact?utm_source=mcp`, status: PAGE_STATUS }]);
    });

  tool("business_check_service_area", "Does Mahoday Solar serve my area?",
    "Answers from the owner-confirmed service area only. Until it is configured the answer is 'unconfirmed' and never a guess.",
    { place: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9 .,&-]+$/).describe("City or state") },
    { place: z.string(), confirmed_service_area: z.string().nullable(), covered: z.boolean().nullable() },
    (a) => {
      const area = clean(env.MAHODAYSOLAR_SERVICE_AREA);
      if (!area) return reply("unconfirmed", "The service area is not confirmed. Ask via the website form.", { place: a.place, confirmed_service_area: null, covered: null });
      const norm = (x: string) => x.trim().toLowerCase().replace(/\s+/g, " ");
      const covered = area.split(/[,;|]/).map(norm).includes(norm(a.place));
      return reply(covered ? "ok" : "unconfirmed", covered ? "Listed exactly in the confirmed service area." : "Not listed by that exact name. This does not mean it is excluded; ask to confirm.", { place: a.place, confirmed_service_area: area, covered: covered ? true : null });
    });

  tool("quote_get_link", "Link to the quote form",
    "Returns the website contact URL. Submits nothing and does not prefill the form (the site form does not read parameters today).",
    { interest: z.enum(["amc", "renewal", "maintenance", "cleaning", "inverter", "service", "commercial", "monitoring", "installation"]).describe("What the user wants a quote for") },
    { url: z.string(), interest: z.string(), note: z.string() },
    (a) => reply("ok", "Open the form and choose the enquiry type.", { url: `${SITE_URL}/contact?utm_source=mcp&utm_medium=mcp-tool`, interest: a.interest, note: "Nothing has been sent. Mention your interest on the form." },
      [{ title: "Contact", url: `${SITE_URL}/contact`, status: PAGE_STATUS }]));

  // ---- resources ----------------------------------------------------------
  server.registerResource("pages", "mahodaysolar://pages", { title: "Page index", description: "Canonical page URLs with launch status.", mimeType: "application/json" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ last_reviewed: LAST_REVIEWED, pages: pageIndex, planned_without_url: plannedPages }, null, 2) }] }));
  server.registerResource("sources", "mahodaysolar://sources", { title: "Official sources", description: "Official portals to confirm subsidy and net metering. Not read by this server.", mimeType: "application/json" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ last_reviewed: LAST_REVIEWED, note: SOURCE_NOTE, sources: officialSources }, null, 2) }] }));
  server.registerResource("checklist", new ResourceTemplate("mahodaysolar://checklists/{name}", {
    list: async () => ({ resources: checklistNames.map((n) => ({ uri: `mahodaysolar://checklists/${n}`, name: n, title: checklists[n].title, mimeType: "application/json" })) }),
  }), { title: "Checklist", description: "A solar buyer checklist.", mimeType: "application/json" },
  async (uri, vars) => {
    const name = String(vars.name) as keyof typeof checklists;
    const c = checklists[name];
    if (!c) throw new Error(`Unknown checklist. Valid: ${checklistNames.join(", ")}`);
    return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ last_reviewed: LAST_REVIEWED, ...c }, null, 2) }] };
  });

  // ---- prompts ------------------------------------------------------------
  server.registerPrompt("size_my_rooftop_system", { title: "Size my rooftop system", description: "Walk through sizing with solar_calculate_size.", argsSchema: { monthly_kwh: z.string().describe("Monthly units from the bill") } },
    (a) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: `I use ${a.monthly_kwh} kWh a month. Ask me for the peak sun hours, performance ratio and panel wattage I want to use (do not assume any), then call solar_calculate_size and explain the result. Do not state a price or saving.` } }] }));
  server.registerPrompt("evaluate_an_amc_quote", { title: "Evaluate an AMC quote", description: "Compare AMC quotes by scope first." , argsSchema: {} },
    () => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: "Use amc_get_checklist with name amc-quote-comparison and amc_get_scope to help me compare two solar AMC quotes. Scope first, price last." } }] }));
  server.registerPrompt("check_my_subsidy_options", { title: "Check subsidy options", description: "Point to official sources without stating figures.", argsSchema: { state: z.string().describe("Your state") } },
    (a) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: `I am in ${a.state}. Call subsidy_get_overview and subsidy_get_state and tell me where to confirm current rules. Do not state any subsidy amount or eligibility yourself.` } }] }));
  server.registerPrompt("prepare_for_installation_visit", { title: "Prepare for an installation handover", description: "Acceptance checklist.", argsSchema: {} },
    () => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: "Use amc_get_checklist with name installation-acceptance to prepare me for installation handover." } }] }));

  return { server, toolNames };
}

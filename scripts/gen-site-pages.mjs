// Regenerates src/content/site-pages.json from the site repo's lib/services.ts and lib/posts.ts.
// Usage: node --experimental-strip-types scripts/gen-site-pages.mjs <services.ts> <posts.ts>
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const [s, p] = process.argv.slice(2);
if (!s || !p) { console.error("usage: gen-site-pages.mjs services.ts posts.ts"); process.exit(1); }
const { services } = await import(pathToFileURL(resolve(s)).href);
const { posts } = await import(pathToFileURL(resolve(p)).href);
const out = {
  generated_from: "MeruLocal/mahodaysolar_website branch feat/site-build-2026-10-22 (PR #3, draft, launch-gated)",
  services: services.map((x) => ({ slug: x.slug, path: "/" + x.slug, name: x.name, summary: x.short, description: x.metaDescription, includes: x.includes, steps: x.steps, faq: x.faq, related: x.related, guides: x.guides })),
  guides: posts.map((x) => ({ slug: x.slug, path: "/blog/" + x.slug, title: x.title, description: x.description, topic: x.topic })),
};
writeFileSync(new URL("../src/content/site-pages.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(out.services.length, "services", out.guides.length, "guides");

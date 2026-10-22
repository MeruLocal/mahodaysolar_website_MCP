// Fails if package.json, server.json and the built server disagree on version.
import { readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const srv = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));
const { SERVER_VERSION } = await import("../dist/server.js");
const versions = { "package.json": pkg.version, "server.json": srv.version, "src/server.ts": SERVER_VERSION };
const bad = Object.entries(versions).filter(([, v]) => v !== pkg.version);
if (pkg.mcpName !== srv.name) bad.push(["mcpName vs server.json name", `${pkg.mcpName} != ${srv.name}`]);
if (bad.length) { console.error("version mismatch", versions, bad); process.exit(1); }
console.log("versions ok", versions);

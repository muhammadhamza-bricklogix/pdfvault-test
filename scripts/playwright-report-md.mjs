#!/usr/bin/env node
/**
 * Turns Playwright's JSON results (test-results/results.json) into a
 * scan-friendly Markdown report at test-results/REPORT.md.
 *
 * Usage: node scripts/playwright-report-md.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const JSON_PATH = path.join(ROOT, "test-results", "results.json");
const OUT_PATH = path.join(ROOT, "test-results", "REPORT.md");

if (!fs.existsSync(JSON_PATH)) {
  console.error(`No results.json at ${JSON_PATH}. Run \`bun run test:e2e\` first.`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));

const summary = {
  passed: raw.stats?.expected ?? 0,
  failed: raw.stats?.unexpected ?? 0,
  flaky: raw.stats?.flaky ?? 0,
  skipped: raw.stats?.skipped ?? 0,
  durationMs: raw.stats?.duration ?? 0,
};

const failures = [];
const passes = [];

function walk(suites = [], breadcrumb = []) {
  for (const suite of suites) {
    const trail = [...breadcrumb, suite.title];

    for (const spec of suite.specs ?? []) {
      const fullTitle = [...trail, spec.title].join(" › ");

      for (const t of spec.tests ?? []) {
        for (const r of t.results ?? []) {
          const entry = {
            title: fullTitle,
            status: r.status,
            durationMs: r.duration,
            errors: (r.errors ?? []).map((e) => e.message ?? String(e)),
          };

          if (r.status === "passed") passes.push(entry);
          else if (r.status === "failed" || r.status === "timedOut")
            failures.push(entry);
        }
      }
    }

    if (suite.suites) walk(suite.suites, trail);
  }
}

walk(raw.suites);

const lines = [];

lines.push("# E2E test report");
lines.push("");
lines.push(`_Generated ${new Date().toISOString()}_`);
lines.push("");
lines.push("## Summary");
lines.push("");
lines.push(
  `- ✅ **${summary.passed} passed**, ❌ **${summary.failed} failed**, 🟡 ${summary.flaky} flaky, ⏭ ${summary.skipped} skipped`,
);
lines.push(`- ⏱ Total duration: ${(summary.durationMs / 1000).toFixed(1)}s`);
lines.push("");

if (failures.length > 0) {
  lines.push("## Failures (fix these first)");
  lines.push("");

  failures.forEach((f, i) => {
    lines.push(`### ${i + 1}. ❌ ${f.title}`);
    lines.push("");
    lines.push(`- Status: \`${f.status}\``);
    lines.push(`- Duration: ${(f.durationMs / 1000).toFixed(2)}s`);

    if (f.errors.length > 0) {
      lines.push("- Error:");
      lines.push("");
      lines.push("```");
      f.errors.forEach((e) => lines.push(stripAnsi(e).slice(0, 1500)));
      lines.push("```");
    }

    lines.push("");
  });
}

lines.push("## Passing tests");
lines.push("");
passes.forEach((p) => {
  lines.push(`- ✅ ${p.title}  _(${(p.durationMs / 1000).toFixed(2)}s)_`);
});

lines.push("");
lines.push("---");
lines.push(
  "_Open `playwright-report/index.html` for full HTML report with screenshots + traces._",
);

fs.writeFileSync(OUT_PATH, lines.join("\n") + "\n");
console.log(`Report written: ${OUT_PATH}`);

function stripAnsi(s) {
  return String(s).replace(/\[[0-9;]*m/g, "");
}

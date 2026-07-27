import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("build includes KICKOFF metadata and social preview", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  await access(new URL("../.next/BUILD_ID", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
  assert.match(layout, /<html lang="ko">/);
  assert.match(layout, /KICKOFF — 우리들만의 FC 온라인 리그/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /\/og\.png/);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/);
});

test("includes league scheduling, scoring, and standings product flows", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/leagues/route.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  assert.match(page, /calculateStandings/);
  assert.match(page, /최근 5경기/);
  assert.match(page, /관리 PIN/);
  assert.match(page, /setInterval\(\(\) => loadLeague\(true\), 5000\)/);
  assert.match(page, /overlapsPrevious \* 100/);
  assert.match(page, /이 일정으로 리그 확정/);
  assert.match(page, /두 번씩 대결/);
  assert.match(api, /isValidSchedule/);
  assert.match(api, /from\("matches"\)\.insert/);
  assert.match(schema, /enable row level security/);
});

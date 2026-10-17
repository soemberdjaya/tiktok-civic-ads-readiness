// Fetch every source URL in rules/, hash its text, and open an issue if it changed.
// Hashes are stored in rules/hashes.json; maintainers refresh them when updating the YAML.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';

const root = join(import.meta.dirname, '..', 'rules');
const hashFile = join(root, 'hashes.json');
const known = existsSync(hashFile) ? JSON.parse(readFileSync(hashFile, 'utf8')) : {};
const update = process.argv.includes('--write');

const files = [];
for (const dir of readdirSync(root, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  for (const f of readdirSync(join(root, dir.name))) if (f.endsWith('.yaml')) files.push(join(root, dir.name, f));
}

// Normalize page text so small markup changes do not trigger an issue.
const normalize = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const changed = [];
const next = { ...known };
for (const file of files) {
  const rule = parse(readFileSync(file, 'utf8'));
  try {
    const target = rule.watch_url ?? rule.url;
    const res = await fetch(target, { headers: { 'User-Agent': 'civic-ad-readiness rules watcher' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const isPdf = (res.headers.get('content-type') ?? '').includes('pdf') || target.endsWith('.pdf');
    const content = isPdf ? Buffer.from(await res.arrayBuffer()) : normalize(await res.text());
    const hash = createHash('sha256').update(content).digest('hex');
    // Short pause to avoid bot rate limiting at the source.
    await new Promise((r) => setTimeout(r, 1500));
    if (known[rule.id] && known[rule.id] !== hash) changed.push(rule);
    next[rule.id] = hash;
    console.log(`${known[rule.id] && known[rule.id] !== hash ? 'CHANGED' : 'ok     '} ${rule.id}`);
  } catch (e) {
    console.log(`failed  ${rule.id}: ${e.message}`);
  }
}

if (update) {
  writeFileSync(hashFile, JSON.stringify(next, null, 2) + '\n');
  console.log('hashes.json updated.');
} else if (changed.length && process.env.GH_TOKEN) {
  const body = [
    'The following source pages changed since the last hash:',
    '',
    ...changed.map((r) => `- [ ] **${r.id}**: [${r.title}](${r.url})`),
    '',
    'Steps: read the changes, update the YAML in `rules/`, bump `rules/VERSION`, add or update test cases, then run `pnpm rules:check --write`.',
  ].join('\n');
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
    body: JSON.stringify({ title: `Rule sources changed (${new Date().toISOString().slice(0, 10)})`, body, labels: ['rules'] }),
  });
  console.log(`Issue created: HTTP ${res.status}`);
}

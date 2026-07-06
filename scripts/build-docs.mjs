// Renders README.md to a static docs page in ./site for deployment to
// vitest-visual-diff.coey.dev. No fabricated status badges — the page shows
// the version from package.json and a link to CI-verifiable receipts
// (experiments/, the GitHub repo) instead of a hardcoded pass/fail banner.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const md = readFileSync('README.md', 'utf8');

const renderer = new marked.Renderer();
const slugCounts = new Map();
function slugify(text) {
  const base = text
    .toLowerCase()
    .replace(/[^\w]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const n = slugCounts.get(base) ?? 0;
  slugCounts.set(base, n + 1);
  return n === 0 ? base : `${base}-${n}`;
}
renderer.heading = ({ tokens, depth }) => {
  const text = tokens.map((t) => t.raw ?? t.text ?? '').join('');
  const id = slugify(text.replace(/`/g, ''));
  const inline = marked.parseInline(text);
  return `<h${depth} id="${id}">${inline}</h${depth}>\n`;
};
const body = marked.parse(md, { renderer });

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>vitest-visual-diff — Vitest Browser Mode matcher</title>
<meta name="description" content="${pkg.description}">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1c1917; background: #fafaf9; overflow-x: hidden; }
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; padding: 18px 28px; background: #fff; border-bottom: 1px solid #e7e5e4; position: sticky; top: 0; z-index: 10; }
  header h1 { font-size: 20px; margin: 0; font-family: ui-monospace, SFMono-Regular, monospace; }
  .badge { font-size: 12px; padding: 3px 9px; border-radius: 999px; border: 1px solid #d6d3d1; color: #57534e; text-decoration: none; }
  .badge:hover { border-color: #a8a29e; }
  .layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); max-width: 1200px; margin: 0 auto; }
  nav.side { padding: 28px 20px; border-right: 1px solid #e7e5e4; position: sticky; top: 61px; align-self: start; height: calc(100vh - 61px); overflow-y: auto; }
  nav.side h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #a8a29e; margin: 0 0 10px; }
  nav.side a { display: block; padding: 5px 0; color: #44403c; text-decoration: none; font-size: 14px; }
  nav.side a:hover { color: #2563eb; }
  main { padding: 28px 40px 80px; max-width: 720px; min-width: 0; }
  main h1 { font-size: 30px; }
  main h2 { font-size: 22px; margin-top: 44px; border-top: 1px solid #e7e5e4; padding-top: 28px; }
  main h3 { font-size: 17px; margin-top: 30px; }
  main p, main li { line-height: 1.65; font-size: 15.5px; }
  code { font-family: ui-monospace, SFMono-Regular, monospace; background: #f1f0ee; padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
  pre { background: #1c1917; color: #f4f4f4; padding: 16px 18px; border-radius: 10px; overflow-x: auto; }
  pre code { background: none; padding: 0; color: inherit; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 14px; }
  th, td { border: 1px solid #e7e5e4; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f5f5f4; }
  blockquote { border-left: 3px solid #d6d3d1; margin: 16px 0; padding: 4px 16px; color: #57534e; background: #f5f5f4; border-radius: 0 8px 8px 0; }
  a { color: #2563eb; }
</style>
</head>
<body>
<header>
  <h1>vitest-visual-diff</h1>
  <span class="badge">v${pkg.version}</span>
  <a class="badge" href="https://github.com/acoyfellow/vitest-visual-diff">source</a>
  <a class="badge" href="https://github.com/acoyfellow/vitest-visual-diff/tree/main/experiments">test receipts</a>
</header>
<div class="layout">
  <nav class="side">
    <h2>Start here</h2>
    <a href="#tutorial-your-first-comparison">Tutorial</a>
    <a href="#how-to-guides">How-to guides</a>
    <a href="#reference">Reference</a>
    <a href="#explanation">Explanation</a>
    <h2 style="margin-top:24px;">Tiers</h2>
    <a href="#reference">structure · style · pixels</a>
    <a href="#reference">semantics · references</a>
  </nav>
  <main>
${body}
  </main>
</div>
</body>
</html>`;

mkdirSync('site', { recursive: true });
writeFileSync('site/index.html', html);
console.log(`wrote site/index.html (${html.length} bytes)`);

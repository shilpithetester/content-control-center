// Public compiled-asset inspection only. Never prints keys or script bodies.
import assert from 'node:assert/strict';
const [preview, expected] = process.argv.slice(2);
assert.ok(preview && /^[a-z]{20}$/.test(expected || ''), 'Usage: node scripts/check-preview-isolation.mjs https://preview.vercel.app EXPECTED_PROJECT_REF');
const origin = new URL(preview);
assert.equal(origin.protocol, 'https:');
assert.ok(origin.hostname.endsWith('.vercel.app'));
async function read(url) {
 const response = await fetch(url, {signal: AbortSignal.timeout(20000), redirect:'error'});
 assert.ok(response.ok, 'Asset HTTP '+response.status);
 return response.text();
}
const html = await read(origin);
const paths = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]);
const projects = new Set();
for (const path of paths) {
 const url = new URL(path, origin);
 assert.equal(url.origin, origin.origin, 'Unexpected third-party script');
 const script = await read(url);
 for (const match of script.matchAll(/https:\/\/([a-z]{20})\.supabase\.co/g)) projects.add(match[1]);
}
const pass = projects.size === 1 && projects.has(expected);
console.log(JSON.stringify({check:'compiled_preview_backend',preview:origin.origin,expected_project:expected,observed_projects:[...projects],result:pass?'PASS':'FAIL'}, null, 2));
process.exitCode = pass ? 0 : 1;

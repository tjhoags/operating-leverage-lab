// Scans tracked files and the build output for secrets and private material.
// It is a safety net, not a guarantee: review staged files before release.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const patterns = [
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Anthropic or OpenAI style key', re: /\bsk-(ant-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: 'generic secret assignment', re: /\b(api[_-]?key|secret|password|token)\b\s*[:=]\s*['"][^'"\s]{12,}['"]/i },
  { name: 'email address', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { name: 'home directory path', re: /(\/Users\/[a-z]|\/home\/[a-z]+\/|C:\\Users\\)/ },
  { name: 'phone number', re: /\b(\+?1[ -.])?\(?\d{3}\)?[ -.]\d{3}[ -.]\d{4}\b/ },
];

const allowlistedEmails = new Set(['noreply@anthropic.com']);
const skip = (file) => /^(package-lock\.json|LICENSE)$/.test(file) || file.startsWith('node_modules/');

function listTracked() {
  return execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
}

function listDist(dir = 'dist', out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listDist(full, out);
    else out.push(full);
  }
  return out;
}

const findings = [];
for (const file of [...listTracked(), ...listDist()]) {
  if (skip(file)) continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (text.includes('\u0000')) continue;
  for (const { name, re } of patterns) {
    const match = text.match(re);
    if (!match) continue;
    if (name === 'email address' && allowlistedEmails.has(match[0])) continue;
    if (name === 'home directory path' && file === 'scripts/scan-private.mjs') continue;
    findings.push(`${file}: ${name} (${match[0].slice(0, 40)})`);
  }
}

if (findings.length > 0) {
  console.error('Possible secrets or private material found:');
  for (const f of findings) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`Scanned ${listTracked().length} tracked files and ${listDist().length} build files: nothing flagged.`);

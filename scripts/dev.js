#!/usr/bin/env node
// Loads .dev.vars into the environment before starting wrangler pages dev.
// Keeps secrets out of wrangler.jsonc and out of source control.
const { readFileSync } = require('fs');
const { spawn } = require('child_process');

try {
  const lines = readFileSync('.dev.vars', 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = val;
  }
} catch {
  // No .dev.vars — that's fine in CI / production
}

const proc = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['wrangler', 'pages', 'dev', '.'],
  { stdio: 'inherit', env: process.env },
);

proc.on('exit', code => process.exit(code ?? 0));

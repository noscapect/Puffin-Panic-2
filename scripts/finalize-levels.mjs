#!/usr/bin/env node
/**
 * finalize-levels.mjs
 *
 * One-command campaign finalization pipeline:
 *  1) Portal audit
 *  2) Auto-fix portal placement (normal + deep)
 *  3) Re-audit portals
 *  4) Full QA with optional skill-budget auto-fix
 *  5) Final QA summary
 *
 * Usage:
 *   node scripts/finalize-levels.mjs
 *   node scripts/finalize-levels.mjs --no-budget-fix
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

const applyBudgetFix = !process.argv.includes('--no-budget-fix');

function runNodeScript(scriptRelPath, args = [], options = {}) {
  const scriptAbsPath = join(root, scriptRelPath);
  const result = spawnSync(process.execPath, [scriptAbsPath, ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: false
  });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${scriptRelPath} failed with exit code ${result.status ?? 'unknown'}`);
  }
  return result.status ?? 1;
}

function section(title) {
  console.log(`\n=== ${title} ===\n`);
}

try {
  section('Level Finalization Pipeline');
  console.log(`Budget auto-fix: ${applyBudgetFix ? 'ON' : 'OFF'}`);

  // ── Step 1: Deep audit + auto-fix (gameplay issues) ──
  section('Deep Audit + Auto-Fix');
  runNodeScript('scripts/deep-audit-all.mjs', ['--fix']);

  // ── Step 2: Portal audit + fix ──
  section('Portal Audit (pre-fix)');
  const preAuditCode = runNodeScript('scripts/audit-portals.mjs', [], { allowFailure: true });
  if (preAuditCode !== 0) {
    section('Applying Portal Fixes');
    runNodeScript('scripts/fix-portals.mjs');
    runNodeScript('scripts/fix-portals-deep.mjs');
  } else {
    console.log('No portal issues found in pre-audit.');
  }

  section('Portal Audit (post-fix)');
  runNodeScript('scripts/audit-portals.mjs', [], { allowFailure: true });

  // ── Step 3: Full route QA ──
  section('Full QA');
  if (applyBudgetFix) {
    runNodeScript('scripts/qa-all-levels.mjs', ['--fix-budgets']);
  }
  runNodeScript('scripts/qa-all-levels.mjs');

  // ── Step 4: Verification deep audit (should produce 0 errors) ──
  section('Verification Deep Audit');
  runNodeScript('scripts/deep-audit-all.mjs');

  section('Done');
  console.log('Finalization pipeline complete.');
  console.log('See reports/qa-summary.json and reports/deep-audit.json for campaign status.');
} catch (err) {
  console.error('\nLevel finalization failed.');
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

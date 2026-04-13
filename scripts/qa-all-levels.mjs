/**
 * qa-all-levels.mjs
 *
 * Runs lint-level.mjs and route-analyze.mjs on every level listed in
 * levels/manifest.json and produces a summary report.
 *
 * Usage:
 *   node scripts/qa-all-levels.mjs [--fix-budgets]
 *
 * With --fix-budgets, levels whose route is NOT_FOUND will have their skill
 * budgets updated in-place to match the recommendedBudget from the route
 * analyzer.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');
const FIX_BUDGETS = process.argv.includes('--fix-budgets');

const reportsDir = join(root, 'reports');
if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

// ─── Load manifest ────────────────────────────────────────────────────────────
const manifest = JSON.parse(readFileSync(join(root, 'levels', 'manifest.json'), 'utf8'));
const manifestFiles = manifest.levels.map(f => join(root, 'levels', f));
const missingLevelFiles = manifestFiles.filter(f => !existsSync(f));
const levelFiles = manifestFiles.filter(f => existsSync(f));

// ─── Run one level through the pipeline ──────────────────────────────────────
function runQA(levelFile) {
    const base     = levelFile.replace(/\\/g, '/').split('/').pop().replace('.json', '');
    const lintOut  = join(reportsDir, `${base}.lint.json`);
    const routeOut = join(reportsDir, `${base}.route.json`);

    // Lint
    try {
        execSync(
            `node "${join(root, 'scripts', 'lint-level.mjs')}" --file="${levelFile}" --out="${lintOut}" --no-fail`,
            { stdio: 'pipe' }
        );
    } catch (_) { /* --no-fail means exit 0 always */ }

    // Route
    try {
        execSync(
            `node "${join(root, 'scripts', 'route-analyze.mjs')}" --file="${levelFile}" --out="${routeOut}" --no-fail`,
            { stdio: 'pipe' }
        );
    } catch (_) {}

    // Parse results
    let lint  = {};
    let route = {};
    try { lint  = JSON.parse(readFileSync(lintOut,  'utf8')); } catch (_) {}
    try { route = JSON.parse(readFileSync(routeOut, 'utf8')); } catch (_) {}

    return { base, levelFile, lint, route };
}

// ─── Apply recommended budget fix ─────────────────────────────────────────────
function applyBudgetFix(levelFile, recommendedBudget) {
    const raw = readFileSync(levelFile, 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    const current = data.skills || {};
    let changed = false;
    for (const [skill, count] of Object.entries(recommendedBudget)) {
        if (count > (current[skill] || 0)) {
            current[skill] = count;
            changed = true;
        }
    }
    if (changed) {
        data.skills = current;
        writeFileSync(levelFile, JSON.stringify(data, null, 2));
        return true;
    }
    return false;
}

// ─── Run QA on all levels ─────────────────────────────────────────────────────
console.log(`Running QA on ${levelFiles.length} levels${FIX_BUDGETS ? ' (with budget auto-fix)' : ''}...\n`);
if (missingLevelFiles.length) {
    console.log(`Skipping ${missingLevelFiles.length} missing level file(s) listed in manifest:`);
    for (const f of missingLevelFiles) {
        const base = f.replace(/\\/g, '/').split('/').pop();
        console.log(`  - ${base}`);
    }
    console.log('');
}

// Route analyzer now supports all 8 skills including miner/digger
const ADVANCED_SKILLS = [];

const results   = [];
let totalErrors = 0;
let totalWarn   = 0;
let routeOk     = 0;
let routeFail   = 0;
let routeSkip   = 0;
let budgetFixed = 0;

for (const lf of levelFiles) {
    // Check for advanced skills before running route analysis
    let levelData = {};
    try { levelData = JSON.parse(readFileSync(lf, 'utf8')); } catch (_) {}
    const skills = levelData.skills || {};
    const usesAdvancedSkills = ADVANCED_SKILLS.some(s => (skills[s] || 0) > 0);

    const r = runQA(lf);
    results.push(r);

    const lintPass  = r.lint.pass !== false;
    const lintErr   = r.lint.errorCount  || 0;
    const lintWarn  = r.lint.warnCount   || 0;
    const routeData = r.route.route || {};          // nested: report.route.ok
    const rOk       = routeData.ok === true;
    const jag       = r.lint.jaggednessScore != null ? `jag=${r.lint.jaggednessScore}` : '';

    totalErrors += lintErr;
    totalWarn   += lintWarn;

    let distStr, routeIcon;
    if (rOk) {
        routeOk++;
        distStr   = 'FOUND';
        routeIcon = '✔';
    } else if (usesAdvancedSkills) {
        routeSkip++;
        distStr   = `SKIP (miner/digger — beyond analyzer scope)`;
        routeIcon = '⏭';
    } else {
        routeFail++;
        distStr   = `NOT_FOUND (dist=${routeData.closest?.distToExit ?? '?'})`;
        routeIcon = '✗';
    }

    const lintIcon  = lintErr ? '✗' : lintWarn ? '⚠' : '✔';

    let fixNote = '';
    if (!rOk && !usesAdvancedSkills && FIX_BUDGETS && routeData.recommendedBudget) {
        const fixed = applyBudgetFix(lf, routeData.recommendedBudget);
        if (fixed) { budgetFixed++; fixNote = ' [budget updated]'; }
    }

    console.log(
        `  ${lintIcon} lint  ${routeIcon} route  ${r.base.padEnd(14)}  ` +
        `errors=${lintErr} warns=${lintWarn}  ${jag}  route=${distStr}${fixNote}`
    );

    if (lintErr) {
        const errs = (r.lint.errors || []).map(e => `      ${e.code}: ${e.msg}`).join('\n');
        if (errs) console.log(errs);
    }
    if (!rOk && !usesAdvancedSkills && routeData.suggestion) {
        console.log(`      hint: ${routeData.suggestion}`);
    }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
const summary = {
    levels: results.length,
    manifestLevels: manifestFiles.length,
    missingLevelFiles: missingLevelFiles.map(f => f.replace(/\\/g, '/').split('/').pop()),
    lintErrorsTotal:   totalErrors,
    lintWarningsTotal: totalWarn,
    routeFound:        routeOk,
    routeSkip:         routeSkip,
    routeNotFound:     routeFail,
    budgetsFixed:      budgetFixed,
    details: results.map(r => {
        const rd = r.route?.route || {};
        return {
            file:       r.base,
            lintPass:   r.lint.pass !== false,
            lintErrors: r.lint.errorCount  || 0,
            lintWarns:  r.lint.warnCount   || 0,
            routeOk:    rd.ok === true,
            distToExit: rd.closest?.distToExit,
            recommendedBudget: rd.recommendedBudget,
            blockedByBudget:   rd.blockedByBudget,
        };
    }),
};

const summaryPath = join(reportsDir, 'qa-summary.json');
writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log(`
Summary
    Levels:       ${results.length}
    Missing files:${missingLevelFiles.length}
  Lint errors:  ${totalErrors}
  Lint warnings:${totalWarn}
  Route FOUND:  ${routeOk}/${results.length}
    Route SKIP:   ${routeSkip}  (levels use miner/digger — beyond analyzer scope)
  Route FAIL:   ${routeFail}/${results.length}
  Budgets fixed:${budgetFixed}

Full report: reports/qa-summary.json`);

if (routeFail > 0 && !FIX_BUDGETS) {
    console.log('\nRun again with --fix-budgets to auto-raise skill budgets on failing levels.');
}

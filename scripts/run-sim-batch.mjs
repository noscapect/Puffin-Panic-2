import { execSync } from "child_process";
import { writeFileSync } from "fs";

const levels = [
  "level_005","level_008","level_009","level_017","level_018","level_019",
  "level_023","level_025","level_027","level_036","level_037","level_038",
  "level_039","level_040","level_041","level_044","level_046","level_049",
  "level_050","level_051","level_053","level_055","level_059","level_060",
  "level_066","level_076","level_078","level_082","level_084","level_085",
  "level_087","level_090","level_098","level_099"
];

const results = [];
let ok = 0, fail = 0;

for (const f of levels) {
  const t0 = Date.now();
  let status, detail = "";
  try {
    const out = execSync(
      `node scripts/route-sim.mjs --file=levels/${f}.json --no-fail`,
      { timeout: 20000, encoding: "utf8" }
    ).trim();
    if (out.includes("SOLVABLE")) {
      ok++;
      status = "OK";
    } else {
      fail++;
      status = "FAIL";
      detail = out;
    }
  } catch (e) {
    fail++;
    status = "TIMEOUT";
  }
  const ms = Date.now() - t0;
  results.push({ level: f, status, ms, detail });
  const icon = status === "OK" ? "OK" : status === "TIMEOUT" ? "TO" : "FA";
  process.stdout.write(`${icon} ${f} (${ms}ms)\n`);
}

console.log(`\nSolvable: ${ok}/${levels.length}  Failed: ${fail}`);

// Write detailed results to file
writeFileSync("reports/sim-batch-results.json", JSON.stringify(results, null, 2));
console.log("Results written to reports/sim-batch-results.json");

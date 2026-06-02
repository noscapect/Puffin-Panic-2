#!/usr/bin/env node

const FPS = 30;
const MIN_RELEASE_RATE = 1;
const MAX_RELEASE_RATE = 99;
const MIN_SPAWN_INTERVAL = 3;
const MAX_SPAWN_INTERVAL = FPS * 8;

function clampReleaseRate(value) {
  return Math.max(MIN_RELEASE_RATE, Math.min(MAX_RELEASE_RATE, Number(value) || MIN_RELEASE_RATE));
}

function spawnIntervalFromReleaseRate(value) {
  const rate = clampReleaseRate(value);
  const t = (rate - MIN_RELEASE_RATE) / (MAX_RELEASE_RATE - MIN_RELEASE_RATE);
  return Math.max(MIN_SPAWN_INTERVAL, Math.round(MAX_SPAWN_INTERVAL - (MAX_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL) * t));
}

function releaseRateFromSpawnInterval(interval) {
  const clampedInterval = Math.max(MIN_SPAWN_INTERVAL, Math.min(MAX_SPAWN_INTERVAL, Number(interval) || MAX_SPAWN_INTERVAL));
  const t = (MAX_SPAWN_INTERVAL - clampedInterval) / (MAX_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL);
  return clampReleaseRate(Math.round(MIN_RELEASE_RATE + t * (MAX_RELEASE_RATE - MIN_RELEASE_RATE)));
}

const levelSevenDefaultInterval = 60;
const defaultReleaseRate = releaseRateFromSpawnInterval(levelSevenDefaultInterval);
const slowestInterval = spawnIntervalFromReleaseRate(MIN_RELEASE_RATE);
const fastestInterval = spawnIntervalFromReleaseRate(MAX_RELEASE_RATE);

const errors = [];
if (defaultReleaseRate <= MIN_RELEASE_RATE) {
  errors.push(`Level 7 default interval ${levelSevenDefaultInterval} maps to minimum release rate ${defaultReleaseRate}; player cannot slow it down.`);
}
if (slowestInterval <= levelSevenDefaultInterval) {
  errors.push(`Slowest interval ${slowestInterval} must be greater than Level 7 default ${levelSevenDefaultInterval}.`);
}
if (fastestInterval >= levelSevenDefaultInterval) {
  errors.push(`Fastest interval ${fastestInterval} must be less than Level 7 default ${levelSevenDefaultInterval}.`);
}

console.log('Release-rate QC');
console.log(`Level 7 default interval: ${levelSevenDefaultInterval} ticks`);
console.log(`Mapped default release rate: ${defaultReleaseRate}`);
console.log(`Slowest slider interval: ${slowestInterval} ticks`);
console.log(`Fastest slider interval: ${fastestInterval} ticks`);

if (errors.length > 0) {
  console.log('\x1b[31m[FAIL]\x1b[0m release-rate controls');
  for (const error of errors) console.log(`       - ${error}`);
  process.exit(1);
}

console.log('\x1b[32m[PASS]\x1b[0m release-rate controls');

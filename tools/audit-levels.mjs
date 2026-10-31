// Static audit of generated levels: floor gaps, support for checkpoints and
// entities, and arena coverage. Run with:
//   node tools/audit-levels.mjs
import { buildLevel, topAt } from '../js/world.js';
import { MAPS, MAP_ORDER, ENEMIES } from '../js/data.js';

const SEEDS = 300;
let problems = 0;
const summary = {};

function report(mapId, seed, msg) {
  problems++;
  if (problems < 80) console.log(`[${mapId} seed ${seed}] ${msg}`);
}

function supports(level, x, y) {
  for (const s of level.solids) {
    if (x >= s.x && x <= s.x + s.w && Math.abs(s.y - y) <= 2) return true;
  }
  for (const p of level.oneWays) {
    if (x >= p.x && x <= p.x + p.w && Math.abs(p.y - y) <= 3) return true;
  }
  return false;
}

for (const mapId of MAP_ORDER) {
  const map = MAPS[mapId];
  const stat = { seeds: 0, gaps: 0, tinyGaps: 0, oddSteps: 0 };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const level = buildLevel(mapId, 1, seed);
    stat.seeds++;
    if (!level.start) report(mapId, seed, 'no start');
    if (level.start && !supports(level, level.start.x, level.start.y + 15)) {
      report(mapId, seed, `start unsupported at ${level.start.x},${level.start.y}`);
    }
    for (const c of level.checkpoints) {
      if (!supports(level, c.x + 8, c.y + 20)) report(mapId, seed, `checkpoint unsupported at ${Math.round(c.x)}`);
    }
    for (const c of level.chests) {
      if (!supports(level, c.x + 8, c.y + 14)) report(mapId, seed, `chest unsupported at ${Math.round(c.x)}`);
    }
    if (level.portal && !supports(level, level.portal.x + 13, level.portal.y + level.portal.h)) {
      report(mapId, seed, 'portal unsupported');
    }
    for (const sp of level.spawns) {
      const cfg = ENEMIES[sp.type];
      if (!cfg || cfg.flying) continue;
      if (!supports(level, sp.x, sp.y + cfg.height)) report(mapId, seed, `${sp.type} spawn unsupported at ${Math.round(sp.x)}`);
    }
    if (level.arena) {
      const a = level.arena;
      for (let x = a.x0; x <= a.x1 - 1; x += 8) {
        const t = topAt(level, x);
        if (t == null || Math.abs(t - a.floorY) > 2) {
          report(mapId, seed, `arena floor hole at ${x}`);
          break;
        }
      }
    }
    // Scan floor coverage (solid ground only). Intentionally removed chunks are
    // the gap sections; tiny cracks are bugs.
    let prevSolid = false;
    let gapStart = null;
    for (let x = 0; x <= level.width; x += 1) {
      const solid = level.solids.some(s => x >= s.x && x < s.x + s.w);
      const oneWay = level.oneWays.some(p => x >= p.x && x < p.x + p.w);
      if (!solid && !oneWay) {
        if (gapStart == null) gapStart = x;
      } else if (gapStart != null) {
        const w = x - gapStart;
        stat.gaps++;
        if (w < 24) {
          stat.tinyGaps++;
          report(mapId, seed, `tiny floor crack ${w}px at ${gapStart}`);
        }
        gapStart = null;
      }
      prevSolid = solid;
    }
  }
  summary[mapId] = stat;
}
console.log('\nSummary:', summary);
console.log('Problems:', problems);
process.exitCode = problems ? 1 : 0;

// ============================================================
// EMBERFALL — world generation & environment rendering
// ============================================================

import { MAPS, ENEMIES, DIFFICULTIES } from './data.js';

export const SCALE = 3;
export const VIEW_W = 1280 / SCALE;
export const VIEW_H = 240;
export const WORLD_HEIGHT = 460;

export const THEMES = {
  woods: {
    id: 'woods',
    skyTop: '#12242b',
    skyMid: '#3c6559',
    skyLow: '#b78b58',
    fog: 'rgba(226, 203, 158, 0.08)',
    topTiles: [0, 1, 2, 3],
    fillTiles: [4, 5],
    baseFill: '#4f8a50',
    edgeTiles: [20, 23],
    oneWayStyle: 'grass',
    accent: '#9bc47a',
  },
  keep: {
    id: 'keep',
    skyTop: '#07060c',
    skyMid: '#0e0b16',
    skyLow: '#1b1220',
    fog: 'rgba(156, 106, 76, 0.06)',
    source: 'tiny',
    topTiles: [40, 14],
    fillTiles: [14],
    baseFill: '#3a3446',
    edgeTiles: [57, 59],
    oneWayStyle: 'bridge',
    accent: '#8ba6bd',
  },
  peak: {
    id: 'peak',
    skyTop: '#070a16',
    skyMid: '#241529',
    skyLow: '#5a2a28',
    fog: 'rgba(226, 103, 44, 0.07)',
    topTiles: [4, 5],
    fillTiles: [4, 5],
    baseFill: '#2a1a18',
    lava: true,
    edgeTiles: [80, 83],
    oneWayStyle: 'bridge',
    accent: '#e2672c',
  },
};

export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function irange(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }

function drawImg(ctx, img, x, y, w, h, flip = false) {
  if (!img) return;
  if (flip) {
    ctx.save();
    ctx.translate(x + w / 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, y, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
}

function tileImg(assets, theme, index) {
  return theme.source === 'tiny' ? assets.tinyImg(index) : assets.ppImg(index);
}

// ============================================================
// LEVEL BUILDER
// ============================================================
export function buildLevel(mapId, difficulty, seed) {
  const map = MAPS[mapId];
  const diff = DIFFICULTIES.find(d => d.id === difficulty) || DIFFICULTIES[0];
  const theme = THEMES[map.theme];
  const rng = makeRng(seed);
  const level = {
    map, difficulty: diff, theme,
    width: 0,
    height: WORLD_HEIGHT,
    killY: WORLD_HEIGHT + 80,
    solids: [],
    oneWays: [],
    oneWaySides: [],
    decor: [],
    doors: [],
    chests: [],
    checkpoints: [],
    spawns: [],
    portal: null,
    arena: null,
    bossTriggerX: null,
    start: { x: 88, y: 0 },
    miniBossSpawned: false,
    seed,
  };

  const addGround = (x, w, topY) => {
    if (w <= 0) return 0;
    level.solids.push({ x: Math.round(x), y: Math.round(topY), w: Math.round(w), h: WORLD_HEIGHT - Math.round(topY) + 40, kind: 'ground' });
    level.width = Math.max(level.width, x + w);
    return Math.round(w);
  };
  const addOneWay = (x, y, w, style = 'grass') => {
    const px = Math.round(x);
    const py = Math.round(y);
    const pw = Math.round(w);
    level.oneWays.push({ x: px, y: py, w: pw, h: 8, style });
    // Thin end caps stop players from walking sideways through the thick
    // grass platforms, while still allowing the top to be one-way.
    const capH = style === 'grass' ? 30 : 9;
    level.oneWaySides.push(
      { x: px, y: py + 2, w: 2, h: capH },
      { x: px + pw - 2, y: py + 2, w: 2, h: capH },
    );
    level.width = Math.max(level.width, x + w);
    return pw;
  };
  const addChest = (x, topY, bonus = false) => {
    const rewardRoll = rng();
    const mats = {};
    const pool = map.rewards;
    const picks = 1 + (rng() < 0.55 ? 1 : 0) + (rng() < 0.3 ? 1 : 0);
    for (let i = 0; i < picks; i++) {
      const mat = pick(rng, pool);
      mats[mat] = (mats[mat] || 0) + irange(rng, 1, 2 + map.level);
    }
    if (map.level >= 2 && rng() < (bonus ? 0.75 : 0.28)) mats.scale = (mats.scale || 0) + 1;
    const gold = Math.round((22 + map.level * 18 + rng() * 30) * diff.gold);
    level.chests.push({ x: Math.round(x), y: Math.round(topY - 14), w: 14, h: 14, opened: false, gold, mats, bonus });
  };
  const addCheckpoint = (x, topY) => {
    level.checkpoints.push({ x: Math.round(x), y: Math.round(topY - 20), w: 16, h: 20, activated: false });
  };
  const DECOR_GAP = {
    pine: 52, sign: 36, torch: 14, chain: 18, banner: 24,
    bush: 16, grass: 13, rock: 14, mushroom: 17, stump: 13,
    crate: 14, barrel: 14, skull: 13, crystal: 14,
  };
  const addDecor = (kind, x, topY, scale = 1, layer = 'back') => {
    const px = Math.round(x);
    for (const d of level.decor) {
      const min = (kind === 'pine' || d.kind === 'pine')
        ? 64
        : Math.max(DECOR_GAP[kind] || 14, DECOR_GAP[d.kind] || 14);
      if (Math.abs(d.x - px) < min) return false;
    }
    for (const c of level.chests) {
      if (Math.abs((c.x + 8) - px) < 24) return false;
    }
    for (const c of level.checkpoints) {
      if (Math.abs((c.x + 8) - px) < 22) return false;
    }
    level.decor.push({ kind, x: px, y: Math.round(topY), scale, layer });
    return true;
  };
  const addSpawn = (type, x, topY, options = {}) => {
    const cfg = ENEMIES[type];
    if (!cfg) return;
    const y = options.flying ? topY - 70 : topY - cfg.height;
    level.spawns.push({ type, x: Math.round(x), y: Math.round(y), topY: Math.round(topY), ...options });
  };

  const scatterDecor = (x1, x2, topY, count = 2) => {
    for (let i = 0; i < count; i++) {
      const x = x1 + rng() * Math.max(20, x2 - x1);
      if (map.theme === 'woods') {
        const r = rng();
        if (r < 0.34) addDecor('pine', x, topY, 2.6 + rng() * 1.2, 'back');
        else if (r < 0.55) addDecor('bush', x, topY, 1.2 + rng() * 0.7, 'front');
        else if (r < 0.73) addDecor('grass', x, topY, 0.9 + rng() * 0.8, 'front');
        else if (r < 0.85) addDecor('rock', x, topY, 0.8 + rng() * 0.5, 'front');
        else if (r < 0.94) addDecor('mushroom', x, topY, 1, 'front');
        else addDecor('sign', x, topY, 1, 'front');
      } else if (map.theme === 'keep') {
        const r = rng();
        if (r < 0.3) addDecor('torch', x, topY - 30, 1, 'back');
        else if (r < 0.5) addDecor('crate', x, topY, 1, 'front');
        else if (r < 0.66) addDecor('chain', x, topY - 150, 1, 'back');
        else if (r < 0.8) addDecor('barrel', x, topY, 1, 'front');
        else if (r < 0.9) addDecor('skull', x, topY, 1, 'front');
        else addDecor('torch', x, topY - 26, 1, 'back');
      } else {
        const r = rng();
        if (r < 0.3) addDecor('pine', x, topY, 2.2 + rng(), 'back');
        else if (r < 0.5) addDecor('rock', x, topY, 0.9 + rng() * 0.6, 'front');
        else if (r < 0.65) addDecor('crystal', x, topY, 1 + rng() * 0.5, 'back');
        else if (r < 0.78) addDecor('torch', x, topY - 28, 1, 'back');
        else if (r < 0.9) addDecor('skull', x, topY, 1, 'front');
        else addDecor('stump', x, topY, 1, 'front');
      }
    }
  };

  const spawnGroup = (x1, x2, count, topY) => {
    const span = Math.max(20, x2 - x1);
    for (let i = 0; i < count; i++) {
      const type = pick(rng, map.pool);
      const cfg = ENEMIES[type];
      const x = x1 + (span / count) * i + rng() * (span / count) * 0.6;
      addSpawn(type, x, cfg.flying ? topY : topY, { flying: !!cfg.flying });
    }
  };

  const buildFlat = () => {
    const w = irange(rng, 190, 300);
    addGround(cursor, w, groundY);
    scatterDecor(cursor + 10, cursor + w - 10, groundY, irange(rng, 1, 3));
    spawnGroup(cursor + 45, cursor + w - 30, irange(rng, 1, 2), groundY);
    cursor += w;
  };

  const buildAmbush = () => {
    const w = irange(rng, 250, 340);
    addGround(cursor, w, groundY);
    addOneWay(cursor + 70, groundY - 48, 64, theme.oneWayStyle);
    scatterDecor(cursor + 10, cursor + w - 10, groundY, 2);
    spawnGroup(cursor + 30, cursor + w - 20, irange(rng, 2, 4), groundY);
    if (rng() < 0.35) addChest(cursor + 90, groundY - 48, false);
    cursor += w;
  };

  const buildGap = () => {
    const gap = irange(rng, 46, 70);
    if (rng() < 0.65) addOneWay(cursor + gap / 2 - 24, groundY - 38, 48, theme.oneWayStyle);
    cursor += gap;
    const ny = clamp(groundY + pick(rng, [-16, 0, 16]), 272, 354);
    const w = irange(rng, 170, 250);
    addGround(cursor, w, ny);
    scatterDecor(cursor + 10, cursor + w - 10, ny, 2);
    spawnGroup(cursor + 40, cursor + w - 30, irange(rng, 1, 2), ny);
    groundY = ny;
    cursor += w;
  };

  const buildSteps = () => {
    const dir = rng() < 0.5 ? -1 : 1;
    let y = groundY;
    const n = irange(rng, 2, 3);
    for (let i = 0; i < n; i++) {
      y = clamp(y + dir * 32, 264, 356);
      const w = 96;
      addGround(cursor, w, y);
      if (rng() < 0.5) addSpawn(pick(rng, map.pool), cursor + 48, y, { flying: false });
      cursor += w;
    }
    groundY = y;
    const w = irange(rng, 150, 220);
    addGround(cursor, w, groundY);
    scatterDecor(cursor + 10, cursor + w - 10, groundY, 2);
    spawnGroup(cursor + 35, cursor + w - 30, irange(rng, 1, 2), groundY);
    cursor += w;
  };

  const buildPlatforms = () => {
    const gap = irange(rng, 105, 150);
    addOneWay(cursor + 18, groundY - 32, 48, 'bridge');
    addOneWay(cursor + 76, groundY - 54, 48, 'bridge');
    if (rng() < 0.4) addChest(cursor + 90, groundY - 54, false);
    cursor += gap;
    const w = irange(rng, 180, 250);
    addGround(cursor, w, groundY);
    scatterDecor(cursor + 10, cursor + w - 10, groundY, 2);
    spawnGroup(cursor + 40, cursor + w - 30, irange(rng, 1, 2), groundY);
    cursor += w;
  };

  const buildTreasure = () => {
    const w = irange(rng, 230, 300);
    addGround(cursor, w, groundY);
    const bx = cursor + w * 0.52;
    addGround(bx, 64, groundY - 44);
    addChest(bx + 26, groundY - 44, true);
    addOneWay(cursor + w * 0.3, groundY - 22, 48, theme.oneWayStyle);
    scatterDecor(cursor + 8, bx - 20, groundY, 2);
    spawnGroup(cursor + 30, cursor + w - 30, irange(rng, 1, 2), groundY);
    cursor += w;
  };

  const buildCheckpoint = () => {
    const w = 180;
    addGround(cursor, w, groundY);
    addCheckpoint(cursor + 88, groundY);
    addDecor(map.theme === 'woods' ? 'sign' : 'torch', cursor + 130, groundY - (map.theme === 'woods' ? 0 : 30), 1, 'front');
    scatterDecor(cursor + 8, cursor + 60, groundY, 2);
    cursor += w;
  };

  const buildMiniBoss = () => {
    const w = 500;
    addGround(cursor, w, groundY);
    addDecor('torch', cursor + 100, groundY - 36, 1.1, 'back');
    addDecor('torch', cursor + 350, groundY - 36, 1.1, 'back');
    addDecor('torch', cursor + 60, groundY - 40, 1, 'back');
    addDecor('torch', cursor + 430, groundY - 40, 1, 'back');
    addCheckpoint(cursor + 118, groundY);
    addChest(cursor + 24, groundY - 44, true);
    addGround(cursor + 16, 64, groundY - 44);
    addSpawn('ogre', cursor + 330, groundY, { miniBoss: true });
    level.miniBossSpawned = true;
    cursor += w;
  };

  // ---- begin construction ----
  let cursor = 0;
  let groundY = 330;
  addGround(0, 430, groundY);
  level.start = { x: 74, y: groundY - 20 };
  const startGroundY = groundY;
  addDecor('sign', 170, groundY, 1, 'front');
  scatterDecor(120, 380, groundY, 4);
  cursor = 430;

  const total = map.length;
  const isBossMap = !!map.boss;
  const arenaStart = isBossMap ? total - 840 : null;
  const checkpointTargets = [total * 0.33, total * 0.66];
  let cpIndex = 0;
  let chestCount = 0;

  const safety = 60;
  let guard = 0;
  while (cursor < (isBossMap ? arenaStart : total - 200) && guard++ < safety) {
    if (cpIndex < checkpointTargets.length && cursor >= checkpointTargets[cpIndex]) {
      buildCheckpoint();
      cpIndex++;
      continue;
    }
    const roll = rng();
    if (chestCount < map.chests && roll < 0.2) {
      buildTreasure();
      chestCount++;
    } else if (roll < 0.4) buildGap();
    else if (roll < 0.57) buildSteps();
    else if (roll < 0.72) buildPlatforms();
    else if (roll < 0.86) buildAmbush();
    else buildFlat();

    if (map.miniBoss && !level.miniBossSpawned && cursor > total * 0.6) {
      buildMiniBoss();
    }
  }

  // guarantee the remaining chests are placed
  while (chestCount < map.chests) {
    buildTreasure();
    chestCount++;
  }

  // final rest / gate
  if (isBossMap) {
    const restX = cursor;
    addGround(restX, 190, groundY);
    addCheckpoint(restX + 90, groundY);
    scatterDecor(restX + 8, restX + 70, groundY, 2);
    cursor += 190;

    const arenaX = cursor;
    const arenaW = 760;
    addGround(arenaX, arenaW, groundY);
    const floorY = groundY;
    level.arena = { x0: arenaX, x1: arenaX + arenaW, floorY, triggerX: arenaX + 280 };
    level.bossTriggerX = level.arena.triggerX;
    addDecor('torch', arenaX + 120, floorY - 42, 1.2, 'back');
    addDecor('torch', arenaX + 620, floorY - 42, 1.2, 'back');
    addDecor('torch', arenaX + 50, floorY - 44, 1.2, 'back');
    addDecor('torch', arenaX + 710, floorY - 44, 1.2, 'back');
    cursor += arenaW;
    level.width = cursor + 20;
  } else {
    const gateX = cursor;
    addGround(gateX, 430, groundY);
    level.portal = { x: gateX + 250, y: groundY - 42, w: 26, h: 42 };
    scatterDecor(gateX + 10, gateX + 200, groundY, 3);
    addDecor('sign', gateX + 100, groundY, 1, 'front');
    spawnGroup(gateX + 80, gateX + 200, 1, groundY);
    level.width = gateX + 460;
    cursor += 460;
  }

  // clamp player spawn to the starting plateau
  level.start.y = startGroundY - 20;

  // nearest solid top at a given x (for safety)
  level.spawns.forEach((s) => {
    if (s.type === 'bat') return;
    const cfg = ENEMIES[s.type];
    if (!cfg) return;
    const top = topAt(level, s.x);
    if (top != null) {
      s.topY = top;
      s.y = top - cfg.height;
    }
  });

  // Keep signs, trees and small props from crowding chests, checkpoints or the
  // shard gate. Decorations are created before some of those interactables.
  level.decor = level.decor.filter(d => {
    for (const c of level.chests) {
      if (Math.abs(d.x - (c.x + 8)) < (d.kind === 'pine' ? 46 : 24)) return false;
    }
    for (const c of level.checkpoints) {
      if (Math.abs(d.x - (c.x + 8)) < (d.kind === 'pine' ? 42 : 22)) return false;
    }
    if (level.portal && Math.abs(d.x - (level.portal.x + 13)) < (d.kind === 'pine' ? 52 : 30)) return false;
    return true;
  });

  return level;
}

export function topAt(level, x) {
  let top = null;
  for (const s of level.solids) {
    if (x >= s.x && x <= s.x + s.w) {
      if (top == null || s.y < top) top = s.y;
    }
  }
  return top;
}

// ============================================================
// BACKGROUND
// ============================================================
export function drawBackground(ctx, cam, themeName, t, assets) {
  if (themeName === 'woods') drawWoods(ctx, cam, t, assets);
  else if (themeName === 'keep') drawKeep(ctx, cam, t, assets);
  else drawPeak(ctx, cam, t, assets);
}

function drawWoods(ctx, cam, t, assets) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#0d2029');
  g.addColorStop(0.42, '#294a47');
  g.addColorStop(0.72, '#6a8060');
  g.addColorStop(1, '#c59b65');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W + 1, VIEW_H);

  // sun
  const sunX = VIEW_W * 0.74 - (cam.x * 0.015) % 40;
  const sunY = 64;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 70);
  sunGlow.addColorStop(0, 'rgba(255, 230, 174, 0.9)');
  sunGlow.addColorStop(0.25, 'rgba(247, 201, 128, 0.35)');
  sunGlow.addColorStop(1, 'rgba(247, 201, 128, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(sunX - 80, sunY - 80, 160, 160);
  ctx.fillStyle = 'rgba(255, 241, 202, 0.7)';
  ctx.beginPath(); ctx.arc(sunX, sunY, 14, 0, Math.PI * 2); ctx.fill();

  // clouds
  if (assets?.pp) {
    const cloudOff = (cam.x * 0.035) % 520;
    const clouds = [
      [30, 32, 153, 1.4],
      [170, 56, 154, 1.1],
      [330, 28, 155, 1.5],
      [470, 64, 153, 1.1],
    ];
    for (const [cx, cy, idx, s] of clouds) {
      const x = ((cx - cloudOff + 600) % 600) - 80;
      ctx.globalAlpha = 0.28;
      drawImg(ctx, assets.ppImg(idx), x, cy, 16 * s, 16 * s);
    }
    ctx.globalAlpha = 1;
  }

  // far mountains — heights are keyed to stable world indices, not the
  // on-screen loop index, so peaks keep their shape as the camera scrolls.
  const off1 = cam.x * 0.09;
  const first1 = Math.floor((off1 - 120) / 80);
  ctx.fillStyle = '#1a3337';
  ctx.beginPath();
  ctx.moveTo(first1 * 80 - off1, 190);
  for (let k = 0; k < 10; k++) {
    const idx = first1 + k;
    const x = idx * 80 - off1;
    const h = 60 + hash2(idx * 1.37, 3) * 45;
    ctx.lineTo(x + 40, 190 - h);
    ctx.lineTo(x + 80, 190);
  }
  ctx.lineTo(VIEW_W + 100, VIEW_H);
  ctx.lineTo(-100, VIEW_H);
  ctx.closePath(); ctx.fill();

  // mid ridge
  const off2 = cam.x * 0.17;
  const first2 = Math.floor((off2 - 140) / 100);
  ctx.fillStyle = '#24443e';
  ctx.beginPath();
  ctx.moveTo(first2 * 100 - off2, 208);
  for (let k = 0; k < 9; k++) {
    const idx = first2 + k;
    const x = idx * 100 - off2;
    const h = 32 + hash2(idx * 1.71, 7) * 34;
    ctx.quadraticCurveTo(x + 50, 208 - h, x + 100, 208);
  }
  ctx.lineTo(VIEW_W + 100, VIEW_H);
  ctx.lineTo(-100, VIEW_H);
  ctx.closePath(); ctx.fill();

  // tree line silhouettes
  const off3 = cam.x * 0.32;
  const first3 = Math.floor((off3 - 80) / 54);
  ctx.fillStyle = '#172d2a';
  for (let k = 0; k < 12; k++) {
    const idx = first3 + k;
    const x = idx * 54 - off3;
    const h = 46 + hash2(idx * 2.13, 11) * 38;
    ctx.beginPath();
    ctx.moveTo(x, 214);
    ctx.lineTo(x + 22, 214 - h);
    ctx.lineTo(x + 44, 214);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(x + 20, 210, 3, 14);
  }

  // haze
  const haze = ctx.createLinearGradient(0, 140, 0, 240);
  haze.addColorStop(0, 'rgba(230, 199, 142, 0)');
  haze.addColorStop(1, 'rgba(230, 199, 142, 0.14)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 140, VIEW_W, 100);

  // drifting motes
  ctx.fillStyle = 'rgba(255, 226, 154, 0.55)';
  for (let i = 0; i < 22; i++) {
    const x = ((i * 67 + t * 5 + cam.x * 0.1) % (VIEW_W + 20));
    const y = 120 + Math.sin(t * 0.7 + i) * 30 + (i * 17) % 80;
    const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2 + i));
    ctx.globalAlpha = a;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;
}

function drawKeep(ctx, cam, t, assets) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#06050a');
  g.addColorStop(0.55, '#0d0a14');
  g.addColorStop(1, '#1a101b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W + 1, VIEW_H);

  // huge brick wall, parallax
  const ox = (cam.x * 0.12) % 48;
  ctx.strokeStyle = 'rgba(104, 79, 97, 0.12)';
  ctx.lineWidth = 1;
  for (let y = 18; y < 220; y += 18) {
    for (let x = -48; x < VIEW_W + 48; x += 48) {
      const bx = x - ox + ((y / 18) % 2 ? 24 : 0);
      ctx.strokeRect(bx + 1, y + 1, 46, 16);
      ctx.fillStyle = 'rgba(24, 19, 33, 0.26)';
      ctx.fillRect(bx + 2, y + 2, 44, 14);
    }
  }

  // arches
  const archOff = (cam.x * 0.2) % 260;
  for (let i = -1; i < 4; i++) {
    const x = i * 260 - archOff + 30;
    const w = 130;
    const topY = 76;
    ctx.fillStyle = '#07050b';
    ctx.beginPath();
    ctx.moveTo(x, 220);
    ctx.lineTo(x, topY + 60);
    ctx.quadraticCurveTo(x, topY, x + w / 2, topY);
    ctx.quadraticCurveTo(x + w, topY, x + w, topY + 60);
    ctx.lineTo(x + w, 220);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(123, 94, 116, 0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // faint torch in arch
    const tx = x + w / 2;
    const glow = ctx.createRadialGradient(tx, 150, 2, tx, 150, 58);
    glow.addColorStop(0, 'rgba(240, 143, 68, 0.28)');
    glow.addColorStop(1, 'rgba(240, 143, 68, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(tx - 60, 90, 120, 120);
    ctx.fillStyle = 'rgba(250, 178, 96, 0.75)';
    ctx.fillRect(tx - 1, 147 + Math.sin(t * 7 + i) * 1.5, 2, 7);
    ctx.fillStyle = 'rgba(255, 220, 150, 0.4)';
    ctx.fillRect(tx - 2, 151, 4, 10);
  }

  // chains
  ctx.strokeStyle = 'rgba(120, 107, 105, 0.28)';
  for (let i = 0; i < 5; i++) {
    const x = ((i * 97 + 20) - cam.x * 0.14) % (VIEW_W + 60);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + Math.sin(i) * 4, 56 + (i * 17) % 50);
    ctx.stroke();
    ctx.fillStyle = 'rgba(120, 107, 105, 0.32)';
    ctx.fillRect(x - 2, 54 + (i * 17) % 50, 5, 5);
  }

  // dust motes
  ctx.fillStyle = 'rgba(205, 165, 129, 0.26)';
  for (let i = 0; i < 20; i++) {
    const x = ((i * 59 + t * 3) % (VIEW_W + 20));
    const y = 40 + ((i * 41) + Math.sin(t * 0.4 + i) * 12) % 170;
    ctx.fillRect(x, y, 1, 1);
  }

  const vign = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 60, VIEW_W / 2, VIEW_H / 2, 260);
  vign.addColorStop(0, 'rgba(0,0,0,0)');
  vign.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawPeak(ctx, cam, t, assets) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#060812');
  g.addColorStop(0.38, '#171126');
  g.addColorStop(0.72, '#3b1c2b');
  g.addColorStop(1, '#713626');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W + 1, VIEW_H);

  // aurora ribbons
  ctx.globalCompositeOperation = 'screen';
  for (let k = 0; k < 3; k++) {
    const grad = ctx.createLinearGradient(0, 20 + k * 22, VIEW_W, 80 + k * 18);
    grad.addColorStop(0, 'rgba(70, 170, 150, 0)');
    grad.addColorStop(0.4, `rgba(${80 + k * 20}, ${190 - k * 30}, ${170 - k * 20}, 0.09)`);
    grad.addColorStop(1, 'rgba(150, 76, 150, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 70 + k * 20);
    for (let x = 0; x <= VIEW_W; x += 40) {
      ctx.lineTo(x, 70 + k * 20 + Math.sin(x * 0.02 + t * 0.18 + k) * 18);
    }
    for (let x = VIEW_W; x >= 0; x -= 40) {
      ctx.lineTo(x, 110 + k * 20 + Math.sin(x * 0.018 - t * 0.15 + k) * 16);
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // moon
  const mx = 348 - (cam.x * 0.01) % 20;
  const my = 48;
  const mg = ctx.createRadialGradient(mx, my, 2, mx, my, 60);
  mg.addColorStop(0, 'rgba(234, 214, 190, 0.45)');
  mg.addColorStop(1, 'rgba(234, 214, 190, 0)');
  ctx.fillStyle = mg;
  ctx.fillRect(mx - 64, my - 64, 128, 128);
  ctx.fillStyle = 'rgba(228, 211, 192, 0.35)';
  ctx.beginPath(); ctx.arc(mx, my, 13, 0, Math.PI * 2); ctx.fill();

  // far peaks
  const off1 = cam.x * 0.07;
  const first1 = Math.floor((off1 - 150) / 90);
  ctx.fillStyle = '#191c2b';
  ctx.beginPath();
  ctx.moveTo(first1 * 90 - off1, 210);
  for (let k = 0; k < 9; k++) {
    const idx = first1 + k;
    const x = idx * 90 - off1;
    const h = 70 + hash2(idx * 1.9, 17) * 50;
    ctx.lineTo(x + 45, 210 - h);
    ctx.lineTo(x + 90, 210);
  }
  ctx.lineTo(VIEW_W + 100, VIEW_H);
  ctx.lineTo(-100, VIEW_H);
  ctx.closePath(); ctx.fill();

  // near jagged peaks
  const off2 = cam.x * 0.16;
  const first2 = Math.floor((off2 - 160) / 110);
  ctx.fillStyle = '#241826';
  ctx.beginPath();
  ctx.moveTo(first2 * 110 - off2, 222);
  for (let k = 0; k < 8; k++) {
    const idx = first2 + k;
    const x = idx * 110 - off2;
    const h = 44 + hash2(idx * 2.3, 23) * 38;
    ctx.lineTo(x + 55, 222 - h);
    ctx.lineTo(x + 110, 222);
  }
  ctx.lineTo(VIEW_W + 100, VIEW_H);
  ctx.lineTo(-100, VIEW_H);
  ctx.closePath(); ctx.fill();

  // snow field
  const snow = ctx.createLinearGradient(0, 175, 0, 235);
  snow.addColorStop(0, 'rgba(196, 205, 215, 0.12)');
  snow.addColorStop(1, 'rgba(196, 205, 215, 0.02)');
  ctx.fillStyle = snow;
  ctx.fillRect(0, 175, VIEW_W, 65);

  // embers rising
  for (let i = 0; i < 24; i++) {
    const x = ((i * 73 + t * 8) % (VIEW_W + 40)) - 20;
    const y = 220 - ((i * 37 + t * 14) % 190);
    const a = 0.15 + 0.4 * (0.5 + 0.5 * Math.sin(t * 3 + i));
    ctx.fillStyle = `rgba(255, ${130 + (i * 7) % 60}, 70, ${a})`;
    ctx.fillRect(x, y, 1.3, 2.2);
  }

  // falling ash
  ctx.fillStyle = 'rgba(205, 190, 178, 0.42)';
  for (let i = 0; i < 42; i++) {
    const x = ((i * 53 + t * 9) % (VIEW_W + 30));
    const y = ((i * 89 + t * 16) % 240);
    ctx.globalAlpha = 0.18 + 0.35 * ((i * 7) % 10) / 10;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;

  const vign = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 70, VIEW_W / 2, VIEW_H / 2, 260);
  vign.addColorStop(0, 'rgba(0,0,0,0)');
  vign.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// ============================================================
// WORLD RENDERING
// ============================================================
function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function drawLavaCrust(ctx, solid, top, x0, x1) {
  const left = Math.max(solid.x, x0);
  const right = Math.min(solid.x + solid.w, x1);
  ctx.save();
  ctx.fillStyle = 'rgba(45, 18, 20, 0.35)';
  ctx.fillRect(left, top + 16, right - left, Math.max(0, Math.min(solid.y + solid.h, top + 220) - top - 16));
  ctx.fillStyle = 'rgba(28, 12, 14, 0.5)';
  ctx.fillRect(left, top, right - left, 2);
  for (let x = solid.x + 20; x < solid.x + solid.w; x += 42) {
    const h = hash2(x * 0.13, top);
    if (h < 0.42) continue;
    const len = 12 + h * 28;
    const yy = top + 3 + h * 8;
    ctx.strokeStyle = 'rgba(255, 104, 44, 0.32)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + 5, yy + 2);
    ctx.lineTo(x + 8, yy - 1);
    ctx.lineTo(x + len, yy + 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 196, 110, 0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 144, 64, 0.5)';
    ctx.fillRect(x + 3, yy + 4, 1.3, 2.2);
  }
  ctx.restore();
}

export function drawTerrain(ctx, level, view, assets) {
  const theme = level.theme;
  const x0 = view.x - 32;
  const x1 = view.x + VIEW_W + 32;
  const y0 = view.y - 32;
  const y1 = view.y + VIEW_H + 32;

  // Merge adjacent solids that share a top height into one render run. Without
  // this, each level segment produced a fake vertical seam where its clipped
  // tiles met the next segment.
  const runs = [];
  const sorted = [...level.solids].sort((a, b) => a.x - b.x || a.y - b.y);
  for (const s of sorted) {
    if (s.x > x1 || s.x + s.w < x0 || s.y > y1) continue;
    let run = null;
    for (let i = runs.length - 1; i >= 0; i--) {
      const r = runs[i];
      if (Math.abs(r.y - s.y) < 0.01 && s.x <= r.x1 + 1) { run = r; break; }
    }
    if (run) {
      run.x1 = Math.max(run.x1, s.x + s.w);
      run.bottom = Math.max(run.bottom, s.y + s.h);
    } else {
      runs.push({ x0: s.x, x1: s.x + s.w, y: s.y, bottom: s.y + s.h });
    }
  }

  for (const run of runs) {
    const top = run.y;
    const startTx = Math.floor(Math.max(run.x0, x0) / 16) * 16;
    const endX = Math.min(run.x1, x1);
    const clipBottom = Math.min(run.bottom, y1 + 16);

    // Clip to the physical run. The old renderer let the last 16px tile
    // overhang the collision box, so players could appear to walk inside a wall.
    ctx.save();
    ctx.beginPath();
    ctx.rect(run.x0, top, run.x1 - run.x0, Math.max(0, clipBottom - top));
    ctx.clip();

    if (theme.baseFill) {
      ctx.fillStyle = theme.baseFill;
      ctx.fillRect(run.x0, top, run.x1 - run.x0, 10);
    }
    for (let tx = startTx; tx < endX; tx += 16) {
      const hsh = hash2(tx / 16, top / 16);
      const topIdx = theme.topTiles[Math.floor(hsh * theme.topTiles.length)];
      drawImg(ctx, tileImg(assets, theme, topIdx), tx, top, 16, 16);
      for (let ty = top + 16; ty < clipBottom; ty += 16) {
        if (ty < y0 - 16) continue;
        const fh = hash2(tx / 16 + 3, ty / 16 + 7);
        const fillIdx = theme.fillTiles[Math.floor(fh * theme.fillTiles.length)];
        drawImg(ctx, tileImg(assets, theme, fillIdx), tx, ty, 16, 16);
      }
    }
    ctx.restore();

    // Crisp, collision-aligned top edge. Do not draw vertical side shadows:
    // they read as seams/grid lines where terrain segments meet.
    ctx.fillStyle = theme.source === 'tiny' ? 'rgba(232, 238, 250, 0.13)' : 'rgba(16, 12, 20, 0.28)';
    ctx.fillRect(run.x0, top, run.x1 - run.x0, 1);

    if (theme.lava) drawLavaCrust(ctx, { x: run.x0, y: top, w: run.x1 - run.x0, h: run.bottom - top }, top, x0, x1);
  }

  for (const p of level.oneWays) {
    if (p.x > x1 || p.x + p.w < x0 || p.y > y1) continue;
    ctx.save();
    ctx.beginPath();
    // Grass slabs are 32px thick (cap + dirt). The old 24px clip cut away
    // almost the whole dirt row, leaving a hollow floating strip.
    const clipH = p.style === 'grass' ? 48 : 24;
    ctx.rect(p.x, p.y - 6, p.w, clipH);
    ctx.clip();
    if (p.style === 'bridge') {
      for (let tx = p.x; tx < p.x + p.w; tx += 16) {
        const first = tx === p.x;
        const last = tx + 16 >= p.x + p.w;
        const idx = first ? 90 : last ? 92 : 91;
        drawImg(ctx, assets.ppImg(idx), tx, p.y - 5, 16, 16);
      }
      ctx.fillStyle = 'rgba(12, 7, 5, 0.3)';
      ctx.fillRect(p.x, p.y + 8, p.w, 1);
    } else {
      if (theme.baseFill) {
        ctx.fillStyle = theme.baseFill;
        ctx.fillRect(p.x, p.y, p.w, 8);
      }
      for (let tx = p.x; tx < p.x + p.w; tx += 16) {
        const hsh = hash2(tx / 16, p.y / 16);
        drawImg(ctx, tileImg(assets, theme, theme.topTiles[Math.floor(hsh * theme.topTiles.length)]), tx, p.y, 16, 16);
        drawImg(ctx, tileImg(assets, theme, theme.fillTiles[Math.floor(hsh * 3) % theme.fillTiles.length]), tx, p.y + 16, 16, 16);
      }
    }
    ctx.restore();
  }
}

export function drawDecor(ctx, level, view, assets, t) {
  const x0 = view.x - 60;
  const x1 = view.x + VIEW_W + 60;
  for (const d of level.decor) {
    if (d.x < x0 || d.x > x1) continue;
    drawOneDecor(ctx, d, assets, t);
  }
}

const GROUND_PROPS = new Set([
  'bush', 'grass', 'rock', 'mushroom', 'sign', 'stump',
  'crate', 'barrel', 'skull', 'crystal',
]);

function drawOneDecor(ctx, d, assets, t) {
  const { kind, x, y, scale } = d;
  const s = scale;
  let img = null;
  let w = 16 * s;
  let h = 16 * s;
  let dx = x - w / 2;
  let dy = y - h;
  let alpha = 1;

  switch (kind) {
    case 'pine': {
      const pine = assets.ppImg(126);
      const bottom = (pine && pine.__bottom) || 16;
      drawImg(ctx, pine, dx, y - h * (bottom / 16), w, h);
      drawImg(ctx, assets.ppImg(136), x - 3 * s, y - 6.5 * s, 6 * s, 6.5 * s);
      return;
    }
    case 'bush':
      img = assets.ppImg(hash2(x, y) > 0.5 ? 124 : 125);
      w = 16 * s; h = 12 * s;
      break;
    case 'grass':
      img = assets.ppImg(124);
      w = 16 * s; h = 10 * s;
      dy = y - h;
      alpha = 0.85;
      break;
    case 'rock':
      img = assets.tinyImg(hash2(x, y) > 0.5 ? 101 : 102);
      w = 16 * s; h = 16 * s;
      break;
    case 'mushroom':
      img = assets.ppImg(128);
      w = 10 * s; h = 10 * s;
      break;
    case 'sign':
      img = assets.ppImg(84);
      w = 14; h = 18;
      dx = x - 7; dy = y - 18;
      break;
    case 'stump':
      img = assets.ppImg(136);
      w = 12 * s; h = 12 * s;
      break;
    case 'crate':
      img = assets.tinyImg(63);
      w = 14; h = 14;
      break;
    case 'barrel':
      img = assets.tinyImg(65);
      w = 14; h = 16;
      break;
    case 'torch':
      img = assets.tinyImg(125 + (Math.floor(x) % 4));
      w = 12; h = 16;
      dy = y - 8; dx = x - 6;
      break;
    case 'banner':
      img = assets.ppImg(132);
      w = 18 * (s / 2); h = 32 * (s / 2);
      dy = y;
      dx = x - w / 2;
      break;
    case 'chain':
      img = assets.tinyImg(76);
      w = 8; h = 12;
      dy = y; dx = x - 4;
      alpha = 0.6;
      break;
    case 'skull':
      img = assets.tinyImg(124);
      w = 12; h = 12;
      break;
    case 'crystal':
      img = assets.ppImg(67);
      w = 12 * s; h = 14 * s;
      alpha = 0.85;
      break;
    default:
      return;
  }
  // Anchor ground props by the actual opaque bottom of the sprite, not the
  // transparent 16x16 cell. This keeps grass tufts and mushrooms on the soil.
  if (img && GROUND_PROPS.has(kind)) {
    const bottom = img.__bottom || 16;
    dy = y - h * (bottom / 16);
  }
  if (img) {
    if (kind === 'torch') {
      ctx.fillStyle = '#3a2a22';
      ctx.fillRect(x - 1, dy + h - 5, 2.4, 10);
      ctx.fillStyle = '#6b4a2e';
      ctx.fillRect(x - 2, dy + h + 3, 4.4, 2);
    }
    ctx.globalAlpha = alpha;
    drawImg(ctx, img, dx, dy, w, h);
    ctx.globalAlpha = 1;
  }
}

export function drawPortal(ctx, portal, t) {
  if (!portal) return;
  const cx = portal.x + portal.w / 2;
  const base = portal.y + portal.h;
  // stone arch
  ctx.fillStyle = '#2a2333';
  ctx.fillRect(cx - 18, base - 38, 7, 38);
  ctx.fillRect(cx + 11, base - 38, 7, 38);
  ctx.fillRect(cx - 20, base - 44, 40, 8);
  ctx.fillStyle = '#4b4058';
  ctx.fillRect(cx - 18, base - 38, 2, 38);
  ctx.fillRect(cx + 16, base - 38, 2, 38);
  ctx.fillStyle = '#1b1624';
  ctx.fillRect(cx - 11, base - 38, 22, 38);

  // swirl
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, base - 20, 1, cx, base - 20, 24);
  g.addColorStop(0, 'rgba(255, 238, 190, 0.75)');
  g.addColorStop(0.35, 'rgba(226, 150, 70, 0.35)');
  g.addColorStop(1, 'rgba(226, 103, 44, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - 30, base - 50, 60, 60);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(255, 215, 150, ${0.24 - i * 0.06})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, base - 20, 8 + i * 5, 15 + i * 3, t * (0.8 + i * 0.2), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // motes
  for (let i = 0; i < 7; i++) {
    const a = t * 1.4 + i * 0.9;
    const px = cx + Math.cos(a) * (7 + i * 1.6);
    const py = base - 20 + Math.sin(a * 0.8) * 16;
    ctx.fillStyle = 'rgba(255, 220, 160, 0.5)';
    ctx.fillRect(px, py, 1.2, 1.2);
  }
}

let openChestCanvas = null;

function openChestSprite(assets) {
  if (openChestCanvas) return openChestCanvas;
  const src = assets.ppImg(150);
  if (!src) return null;
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 20;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  // Dark interior with a few coins still catching the light.
  x.fillStyle = '#201517';
  x.fillRect(2, 5, 12, 6);
  x.fillStyle = '#120d10';
  x.fillRect(3, 6, 10, 4);
  x.fillStyle = '#f2c45e';
  for (const [gx, gy] of [[4, 8], [6, 7], [8, 9], [10, 7], [11, 9]]) x.fillRect(gx, gy, 2, 1);
  // Raised lid.
  x.drawImage(src, 0, 0, 16, 7, 0, 0, 16, 6);
  // Hinges / side walls.
  x.fillStyle = '#6f3e43';
  x.fillRect(2, 5, 2, 6);
  x.fillRect(12, 5, 2, 6);
  // Front of the chest.
  x.drawImage(src, 0, 8, 16, 8, 0, 9, 16, 11);
  openChestCanvas = c;
  return c;
}

export function drawChest(ctx, chest, assets, t) {
  const bob = chest.opened ? 0 : Math.sin(t * 3 + chest.x) * 0.6;
  if (!chest.opened) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(chest.x + 7, chest.y + 7, 1, chest.x + 7, chest.y + 7, 18);
    g.addColorStop(0, 'rgba(255, 205, 120, 0.22)');
    g.addColorStop(1, 'rgba(255, 205, 120, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(chest.x - 12, chest.y - 12, 38, 38);
    ctx.restore();
    drawImg(ctx, assets.ppImg(150), chest.x, chest.y + bob, 16, 16);
  } else {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(chest.x + 8, chest.y + 5, 1, chest.x + 8, chest.y + 5, 20);
    g.addColorStop(0, 'rgba(255, 210, 120, 0.18)');
    g.addColorStop(1, 'rgba(255, 210, 120, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(chest.x - 12, chest.y - 16, 40, 40);
    ctx.restore();
    const sprite = openChestSprite(assets);
    if (sprite) drawImg(ctx, sprite, chest.x, chest.y - 4, 16, 20);
    else drawImg(ctx, assets.ppImg(150), chest.x, chest.y, 16, 16);
  }
}

export function drawCheckpoint(ctx, cp, assets, t) {
  const active = cp.activated;
  if (active) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cp.x + 8, cp.y + 6, 1, cp.x + 8, cp.y + 6, 28);
    g.addColorStop(0, 'rgba(255, 184, 96, 0.4)');
    g.addColorStop(1, 'rgba(255, 120, 50, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cp.x - 22, cp.y - 22, 60, 60);
    ctx.restore();
  }
  drawImg(ctx, assets.tinyImg(92), cp.x, cp.y - 4, 16, 20);
  if (active) {
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * 2.1;
      const fx = cp.x + 8 + Math.sin(a) * 2;
      const fy = cp.y - 4 - ((t * 18 + i * 7) % 12);
      ctx.fillStyle = i === 0 ? 'rgba(255, 232, 170, 0.9)' : 'rgba(255, 144, 60, 0.8)';
      ctx.fillRect(fx, fy, 1.4, 2.2);
    }
  }
}

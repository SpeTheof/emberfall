// ============================================================
// EMBERFALL — save game, progression & economy
// ============================================================

import {
  DEFAULT_SAVE, SAVE_KEY, SAVE_VERSION, MAX_LEVEL, MAX_PLUS,
  GEAR, HEROES, MAPS, DIFFICULTIES, MATERIAL_ORDER, upgradeCost, xpToNext,
} from './data.js';

function num(v, fallback = 0) {
  return Number.isFinite(Number(v)) ? Number(v) : fallback;
}
function int(v, fallback = 0) {
  return Math.max(0, Math.floor(num(v, fallback)));
}

function sanitizeHero(raw = {}) {
  return {
    level: Math.max(1, Math.min(MAX_LEVEL, int(raw.level ?? 1))),
    xp: int(raw.xp ?? 0),
    weaponTier: Math.max(1, Math.min(3, int(raw.weaponTier ?? 1))),
    weaponPlus: Math.max(0, Math.min(MAX_PLUS, int(raw.weaponPlus ?? 0))),
    armorTier: Math.max(1, Math.min(3, int(raw.armorTier ?? 1))),
    armorPlus: Math.max(0, Math.min(MAX_PLUS, int(raw.armorPlus ?? 0))),
  };
}

export function sanitizeSave(raw) {
  const base = DEFAULT_SAVE();
  if (!raw || typeof raw !== 'object') return base;
  const save = {
    ...base,
    ...raw,
    version: SAVE_VERSION,
    materials: { ...base.materials, ...(raw.materials || {}) },
    heroes: { ...base.heroes },
    cleared: { ...base.cleared, ...(raw.cleared || {}) },
    stats: { ...base.stats, ...(raw.stats || {}) },
    settings: { ...base.settings, ...(raw.settings || {}) },
  };
  save.gold = int(save.gold);
  for (const mat of MATERIAL_ORDER) save.materials[mat] = int(save.materials[mat]);
  for (const id of Object.keys(HEROES)) save.heroes[id] = sanitizeHero(raw.heroes?.[id]);
  for (const id of Object.keys(MAPS)) save.cleared[id] = Math.max(0, Math.min(3, int(save.cleared[id])));
  for (const id of Object.keys(save.stats)) save.stats[id] = int(save.stats[id]);
  save.activeHero = HEROES[save.activeHero] ? save.activeHero : 'warrior';
  save.settings.music = Math.max(0, Math.min(1, num(save.settings.music, 0.5)));
  save.settings.sfx = Math.max(0, Math.min(1, num(save.settings.sfx, 0.75)));
  save.settings.shake = !!save.settings.shake;
  save.settings.reduceMotion = !!save.settings.reduceMotion;
  if (!['auto', 'on', 'off'].includes(save.settings.touch)) save.settings.touch = 'auto';
  save.updatedAt = Date.now();
  return save;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return DEFAULT_SAVE();
    return sanitizeSave(JSON.parse(raw));
  } catch (err) {
    console.warn('[Emberfall] Could not read save:', err);
    return DEFAULT_SAVE();
  }
}

let saveTimer = 0;
export function persist(save) {
  save.updatedAt = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (err) {
      console.warn('[Emberfall] Could not save:', err);
    }
  }, 60);
}

export function persistNow(save) {
  save.updatedAt = Date.now();
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch (err) {
    console.warn('[Emberfall] Could not save:', err);
    return false;
  }
}

export function wipeSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { console.warn(err); }
}

export function hasProgress(save) {
  return save.stats.runs > 0 || save.gold > 0 || Object.values(save.cleared).some(v => v > 0) ||
    Object.values(save.heroes).some(h => h.level > 1 || h.weaponTier > 1 || h.armorTier > 1);
}

export function activeHeroProgress(save) {
  return save.heroes[save.activeHero] || save.heroes.warrior;
}

export function addGold(save, amount) {
  const gain = int(amount);
  save.gold += gain;
  save.stats.goldEarned += gain;
  persist(save);
  return gain;
}

export function addMaterials(save, loot) {
  let total = 0;
  for (const [mat, count] of Object.entries(loot || {})) {
    if (!(mat in save.materials)) continue;
    const n = int(count);
    save.materials[mat] += n;
    total += n;
  }
  save.stats.materialsGathered += total;
  persist(save);
  return total;
}

export function awardXP(save, heroId, amount) {
  const hero = save.heroes[heroId];
  if (!hero) return { gained: 0, levels: 0, level: 1, ready: false };
  const gained = int(amount);
  hero.xp += gained;
  let levels = 0;
  while (hero.level < MAX_LEVEL) {
    const need = xpToNext(hero.level);
    if (hero.xp < need) break;
    hero.xp -= need;
    hero.level++;
    levels++;
  }
  if (hero.level >= MAX_LEVEL) hero.xp = 0;
  persist(save);
  return { gained, levels, level: hero.level, xp: hero.xp, next: xpToNext(hero.level) };
}

export function canUpgrade(save, heroId, slot) {
  const hero = save.heroes[heroId];
  if (!hero) return { ok: false, reason: 'No hero' };
  const plus = slot === 'weapon' ? hero.weaponPlus : hero.armorPlus;
  const tier = slot === 'weapon' ? hero.weaponTier : hero.armorTier;
  if (plus >= MAX_PLUS) return { ok: false, reason: 'Fully upgraded', maxed: true };
  const cost = upgradeCost(tier, plus);
  if (save.gold < cost) return { ok: false, reason: `Need ${cost - save.gold} more gold`, cost };
  return { ok: true, cost };
}

export function upgradeGear(save, heroId, slot) {
  const check = canUpgrade(save, heroId, slot);
  if (!check.ok) return check;
  const hero = save.heroes[heroId];
  save.gold -= check.cost;
  if (slot === 'weapon') hero.weaponPlus++;
  else hero.armorPlus++;
  persist(save);
  return { ok: true, cost: check.cost, plus: slot === 'weapon' ? hero.weaponPlus : hero.armorPlus };
}

export function recipeFor(heroId, slot, tier) {
  return GEAR[heroId]?.[slot]?.find(g => g.tier === tier) || null;
}

export function nextTierFor(save, heroId, slot) {
  const hero = save.heroes[heroId];
  const current = slot === 'weapon' ? hero.weaponTier : hero.armorTier;
  if (current >= 3) return null;
  return current + 1;
}

export function canCraft(save, heroId, slot) {
  const tier = nextTierFor(save, heroId, slot);
  if (!tier) return { ok: false, reason: 'Already mastered', maxed: true };
  const gear = recipeFor(heroId, slot, tier);
  if (!gear || !gear.recipe) return { ok: false, reason: 'No recipe' };
  const recipe = gear.recipe;
  const missing = {};
  for (const [key, value] of Object.entries(recipe)) {
    if (key === 'gold') {
      if (save.gold < value) missing.gold = value - save.gold;
    } else {
      const have = save.materials[key] || 0;
      if (have < value) missing[key] = value - have;
    }
  }
  return { ok: Object.keys(missing).length === 0, recipe, gear, tier, missing };
}

export function craftGear(save, heroId, slot) {
  const check = canCraft(save, heroId, slot);
  if (!check.ok) return check;
  const recipe = check.recipe;
  save.gold -= recipe.gold || 0;
  for (const [key, value] of Object.entries(recipe)) {
    if (key === 'gold') continue;
    save.materials[key] -= value;
  }
  const hero = save.heroes[heroId];
  if (slot === 'weapon') {
    hero.weaponTier = check.tier;
    hero.weaponPlus = 0;
  } else {
    hero.armorTier = check.tier;
    hero.armorPlus = 0;
  }
  persist(save);
  return { ok: true, tier: check.tier, recipe };
}

export function clearSummary(save, result) {
  const { mapId, difficulty = 1, victory, loot = {}, kills = 0, bossKilled = false, time = 0, xp = 0 } = result;
  const map = MAPS[mapId];
  const diff = DIFFICULTIES.find(d => d.id === difficulty) || DIFFICULTIES[0];
  const gold = int(loot.gold);
  save.gold += gold;
  save.stats.goldEarned += gold;
  save.stats.runs++;
  save.stats.kills += int(kills);
  if (victory) save.stats.victories++;
  else save.stats.deaths++;
  if (bossKilled) save.stats.bosses++;

  const matsAdded = {};
  for (const [mat, count] of Object.entries(loot.materials || {})) {
    if (!(mat in save.materials) || count <= 0) continue;
    save.materials[mat] += Math.floor(count);
    save.stats.materialsGathered += Math.floor(count);
    matsAdded[mat] = Math.floor(count);
  }

  let leveled = 0;
  const before = save.heroes[save.activeHero].level;
  if (xp > 0) {
    const xpResult = awardXP(save, save.activeHero, xp);
    leveled = xpResult.levels;
  }
  const after = save.heroes[save.activeHero].level;

  if (victory) {
    save.cleared[mapId] = Math.max(save.cleared[mapId] || 0, diff.id);
  }

  persistNow(save);
  return {
    map,
    diff,
    gold,
    materials: matsAdded,
    leveled,
    levelBefore: before,
    levelAfter: after,
    xp,
    victory,
    bossKilled,
    time,
    kills,
  };
}

// ============================================================
// EMBERFALL — game data
// ============================================================

export const SAVE_KEY = 'emberfall.save.v1';
export const SAVE_VERSION = 1;
export const MAX_LEVEL = 12;
export const MAX_PLUS = 5;
// Every hero recovers a small amount of health after staying unhurt.
export const REGEN = { delay: 5, rate: 0.015, min: 1.2 };

export const HEROES = {
  warrior: {
    id: 'warrior',
    name: 'Garrick Ironvale',
    short: 'Garrick',
    title: 'The Ironclad',
    role: 'Vanguard',
    sprite: 87,
    color: '#e08a52',
    colorSoft: 'rgba(224, 138, 82, 0.16)',
    colorLine: 'rgba(224, 138, 82, 0.42)',
    blurb: 'A shield-broken knight who holds the line where others fall. Heavy armour, heavier blade, and a temper forged in the northern wars.',
    base: { hp: 124, defense: 8, speed: 114, damage: 13, crit: 0.04 },
    damageMult: 4,
    survivalMult: 2,
    weaponName: 'Iron Longsword',
    weaponIcon: 'sword',
    attack: { type: 'melee', cooldown: 0.37, reach: 40, arc: 48, combo: [1, 1.08, 1.35] },
    skill: {
      id: 'tempest',
      name: 'Iron Tempest',
      desc: 'Spin with the blade extended, striking every foe around you three times.',
      cooldown: 4,
      icon: 'whirlwind',
    },
    lore: '“Steel is honest. It does not scheme, and it does not run.” — Garrick, to the last of the Iron Guard',
    stats: { hp: 5, power: 4, speed: 3 },
  },
  mage: {
    id: 'mage',
    name: 'Selene Ashweaver',
    short: 'Selene',
    title: 'The Ember Sage',
    role: 'Arcanist',
    sprite: 84,
    color: '#b58ce0',
    colorSoft: 'rgba(181, 140, 224, 0.15)',
    colorLine: 'rgba(181, 140, 224, 0.4)',
    blurb: 'She read the stars until they caught fire. A glass-cannon caster whose spells turn packed rooms into pyres — if she keeps her distance.',
    base: { hp: 82, defense: 3, speed: 106, damage: 11, crit: 0.07 },
    weaponName: 'Apprentice Staff',
    weaponIcon: 'staff',
    attack: { type: 'projectile', cooldown: 0.56, speed: 300, radius: 16, aoe: 26 },
    skill: {
      id: 'nova',
      name: 'Flame Nova',
      desc: 'Detonate a ring of cinders around you, scorching everything in a wide radius.',
      cooldown: 13,
      icon: 'flame',
    },
    lore: '“Every flame remembers the hand that lit it. I intend to be remembered.” — Selene Ashweaver',
    stats: { hp: 2, power: 5, speed: 4 },
  },
  archer: {
    id: 'archer',
    name: 'Wren Shadowmere',
    short: 'Wren',
    title: 'The Wilds’ Eye',
    role: 'Ranger',
    sprite: 85,
    color: '#8fca78',
    colorSoft: 'rgba(143, 202, 120, 0.15)',
    colorLine: 'rgba(143, 202, 120, 0.4)',
    blurb: 'Raised by the green silence of the Whispering Woods. No headwind, no heartbeat, no closing door can spoil her aim.',
    base: { hp: 96, defense: 5, speed: 128, damage: 9, crit: 0.1 },
    weaponName: 'Hunting Bow',
    weaponIcon: 'bow',
    attack: { type: 'arrow', cooldown: 0.26, speed: 440, radius: 6 },
    skill: {
      id: 'rain',
      name: 'Rain of Arrows',
      desc: 'Loose a volley into the sky. Ten arrows fall around you, pinning everything below.',
      cooldown: 14,
      icon: 'arrows',
    },
    lore: '“The forest does not forgive noise. Neither do I.” — Wren Shadowmere',
    stats: { hp: 3, power: 4, speed: 5 },
  },
};

export const HERO_ORDER = ['warrior', 'mage', 'archer'];

// Weapon and armour progression. Tier 1 is the starting kit.
export const GEAR = {
  warrior: {
    weapon: [
      { tier: 1, name: 'Iron Longsword', icon: 'sword', dmg: 13, crit: 0.04, desc: 'A plain guard-issue blade, balanced and honest.' },
      { tier: 2, name: 'Knight’s Edge', icon: 'sword', dmg: 21, crit: 0.07, recipe: { gold: 220, iron: 14, leather: 4 }, desc: 'Tempered steel with a fuller that sings when it swings.' },
      { tier: 3, name: 'Emberfall Greatsword', icon: 'greatsword', dmg: 32, crit: 0.11, recipe: { gold: 520, iron: 22, crystal: 10, scale: 1 }, desc: 'Forged around a shard of dragonbone. It never truly cools.' },
    ],
    armor: [
      { tier: 1, name: 'Leather Jerkin', icon: 'armor', hp: 18, def: 6, desc: 'Sturdy hide and old campaign patches.' },
      { tier: 2, name: 'Ironguard Plate', icon: 'armor', hp: 52, def: 15, recipe: { gold: 260, iron: 18, leather: 8 }, desc: 'The plate of the Iron Guard, reforged for one last march.' },
      { tier: 3, name: 'Cinderforged Aegis', icon: 'armor', hp: 92, def: 27, recipe: { gold: 600, iron: 24, crystal: 12, scale: 2 }, desc: 'Scale, steel and ember bound into a second skin.' },
    ],
  },
  mage: {
    weapon: [
      { tier: 1, name: 'Apprentice Staff', icon: 'staff', dmg: 11, crit: 0.07, desc: 'Oak, copper wire, and a stubborn little flame.' },
      { tier: 2, name: 'Runed Oak Staff', icon: 'staff', dmg: 18, crit: 0.09, recipe: { gold: 220, wood: 14, crystal: 4 }, desc: 'Old-growth oak carved with runes that drink starlight.' },
      { tier: 3, name: 'Pyreheart Staff', icon: 'staff', dmg: 27, crit: 0.13, recipe: { gold: 520, wood: 20, crystal: 12, scale: 1 }, desc: 'A caged ember from the heart of Cinderpeak.' },
    ],
    armor: [
      { tier: 1, name: 'Woolen Robe', icon: 'robe', hp: 12, def: 3, desc: 'Warm, patched, and faintly singed at the cuffs.' },
      { tier: 2, name: 'Runewoven Mantle', icon: 'robe', hp: 38, def: 10, recipe: { gold: 260, leather: 6, wood: 8, crystal: 6 }, desc: 'Threads of silver and spellwork turn aside more than rain.' },
      { tier: 3, name: 'Archon’s Shroud', icon: 'robe', hp: 72, def: 20, recipe: { gold: 600, leather: 10, crystal: 18, scale: 2 }, desc: 'The last robe of an archon who walked into the fire.' },
    ],
  },
  archer: {
    weapon: [
      { tier: 1, name: 'Hunting Bow', icon: 'bow', dmg: 9, crit: 0.1, desc: 'A quick little bow with a draw as smooth as a breath.' },
      { tier: 2, name: 'Yew Warbow', icon: 'bow', dmg: 15, crit: 0.13, recipe: { gold: 220, wood: 16, leather: 6 }, desc: 'A war bow cut from a yew that grew over a fallen hall.' },
      { tier: 3, name: 'Dragonbone Bow', icon: 'bow', dmg: 23, crit: 0.17, recipe: { gold: 520, wood: 20, crystal: 8, scale: 1 }, desc: 'The ribs of a wyrm, strung with its own sinew.' },
    ],
    armor: [
      { tier: 1, name: 'Scout’s Leathers', icon: 'leather', hp: 15, def: 5, desc: 'Supple leathers with room to run and roll.' },
      { tier: 2, name: 'Nightstalker Mail', icon: 'leather', hp: 42, def: 12, recipe: { gold: 260, leather: 14, iron: 8 }, desc: 'Blackened rings that make no sound in the dark.' },
      { tier: 3, name: 'Wyrmshadow Garb', icon: 'leather', hp: 78, def: 22, recipe: { gold: 600, leather: 16, crystal: 12, scale: 2 }, desc: 'Cloak and scale from things that hunt at night.' },
    ],
  },
};

export const MATERIALS = {
  iron: { id: 'iron', name: 'Iron Ore', short: 'Iron', color: '#a9b6c4' },
  leather: { id: 'leather', name: 'Cured Leather', short: 'Leather', color: '#b9855a' },
  crystal: { id: 'crystal', name: 'Crystal Shard', short: 'Crystal', color: '#7ed6e0' },
  wood: { id: 'wood', name: 'Ancient Wood', short: 'Wood', color: '#a8c47a' },
  scale: { id: 'scale', name: 'Dragon Scale', short: 'Scale', color: '#e06a45' },
};
export const MATERIAL_ORDER = ['iron', 'leather', 'crystal', 'wood', 'scale'];

export const DIFFICULTIES = [
  { id: 1, name: 'Normal', short: 'I', hp: 1, dmg: 1, gold: 1, xp: 1, desc: 'A fair fight. Learn the roads.' },
  { id: 2, name: 'Veteran', short: 'II', hp: 1.45, dmg: 1.28, gold: 1.65, xp: 1.25, desc: 'Harder foes. Richer spoils.' },
  { id: 3, name: 'Nightmare', short: 'III', hp: 2.1, dmg: 1.6, gold: 2.5, xp: 1.55, desc: 'Only embers remain. Best loot.' },
];

export const MAPS = {
  woods: {
    id: 'woods',
    numeral: 'I',
    numeralWord: 'SHARD I',
    name: 'Whispering Woods',
    shortName: 'The Woods',
    level: 1,
    theme: 'woods',
    shard: 'Shard of Dawn',
    desc: 'Goblin warbands have strung their totems through the old pines. The first shard sleeps beneath the roots.',
    clearBonus: 130,
    xpClear: 55,
    length: 4300,
    chests: 3,
    checkpoints: 2,
    pool: ['goblin', 'goblin', 'bat', 'slime', 'goblin', 'orc'],
    boss: null,
    miniBoss: null,
    unlock: null,
    threat: 'I — Wandering',
    rewards: ['iron', 'leather', 'wood'],
    accent: '#8fca78',
    thumbClass: 'woods',
    introSub: 'Where the goblin warbands gather.',
    victory: 'The woods grow quiet. For now.',
    defeat: 'The roots drink deep. Try again.',
  },
  keep: {
    id: 'keep',
    numeral: 'II',
    numeralWord: 'SHARD II',
    name: 'Ironhold Keep',
    shortName: 'Ironhold',
    level: 2,
    theme: 'keep',
    shard: 'Shard of Iron',
    desc: 'A drowned fortress held by orcs and their skeleton guard. The Ogre Warden keeps the second shard under lock and chain.',
    clearBonus: 230,
    xpClear: 100,
    length: 5000,
    chests: 4,
    checkpoints: 2,
    pool: ['orc', 'skeleton', 'goblin', 'bat', 'orc', 'skeleton'],
    boss: null,
    miniBoss: 'ogre',
    unlock: 'woods',
    threat: 'II — Occupied',
    rewards: ['iron', 'crystal', 'leather', 'scale'],
    accent: '#8ba6bd',
    thumbClass: 'keep',
    introSub: 'The Iron Guard is dead. Something else wears their armour.',
    victory: 'The keep falls silent. A chain of keys clatters to the flagstones.',
    defeat: 'Ironhold keeps its secrets a while longer.',
  },
  peak: {
    id: 'peak',
    numeral: 'III',
    numeralWord: 'SHARD III',
    name: 'Cinderpeak',
    shortName: 'The Peak',
    level: 3,
    theme: 'peak',
    shard: 'Shard of Flame',
    desc: 'Ash falls like snow on the dragon’s stair. Vaelros the Ashen Wyrm waits at the summit with the last shard in its claws.',
    clearBonus: 400,
    xpClear: 180,
    length: 4100,
    chests: 3,
    checkpoints: 2,
    pool: ['orc', 'skeleton', 'bat', 'slime', 'skeleton'],
    boss: 'dragon',
    miniBoss: null,
    unlock: 'keep',
    threat: 'III — Dragon’s Lair',
    rewards: ['crystal', 'scale', 'iron', 'wood'],
    accent: '#e2672c',
    thumbClass: 'peak',
    introSub: 'The mountain is awake, and it has teeth.',
    victory: 'The wyrm falls. The Cinder Crown is whole again.',
    defeat: 'The mountain keeps its crown.',
  },
};

export const MAP_ORDER = ['woods', 'keep', 'peak'];

export const ENEMIES = {
  goblin: {
    id: 'goblin',
    name: 'Goblin Raider',
    sprite: 112,
    hp: 34,
    damage: 8,
    speed: 58,
    xp: 7,
    gold: [6, 13],
    width: 11,
    height: 15,
    ai: 'goblin',
    threat: 'Common',
    desc: 'Small, quick and spiteful. Goblins fight in packs and run when the pack thins.',
    drops: [['iron', 0.32], ['leather', 0.3], ['wood', 0.2]],
    contact: true,
  },
  orc: {
    id: 'orc',
    name: 'Orc Brute',
    sprite: 110,
    hp: 94,
    damage: 15,
    speed: 36,
    xp: 18,
    gold: [15, 27],
    width: 14,
    height: 16,
    ai: 'orc',
    threat: 'Dangerous',
    desc: 'Armoured in looted plate. A single overhead blow can crack a shield — and the knight behind it.',
    drops: [['iron', 0.5], ['crystal', 0.25], ['leather', 0.15]],
    contact: false,
  },
  bat: {
    id: 'bat',
    name: 'Cinder Bat',
    sprite: 120,
    hp: 22,
    damage: 6,
    speed: 74,
    xp: 6,
    gold: [4, 10],
    width: 14,
    height: 10,
    ai: 'bat',
    threat: 'Common',
    desc: 'Drinks from the warm springs of the deep caves. Swoops in erratic arcs before biting.',
    drops: [['leather', 0.4], ['crystal', 0.28]],
    contact: true,
    flying: true,
  },
  skeleton: {
    id: 'skeleton',
    name: 'Hollow Guard',
    sprite: 82,
    hp: 48,
    damage: 10,
    speed: 32,
    xp: 12,
    gold: [10, 19],
    width: 12,
    height: 16,
    ai: 'skeleton',
    threat: 'Armed',
    desc: 'The old garrison never left. It throws splintered bones with unnerving accuracy.',
    drops: [['iron', 0.4], ['crystal', 0.35]],
    contact: false,
  },
  slime: {
    id: 'slime',
    name: 'Mire Slime',
    sprite: 108,
    hp: 38,
    damage: 7,
    speed: 44,
    xp: 8,
    gold: [5, 12],
    width: 13,
    height: 11,
    ai: 'slime',
    threat: 'Common',
    desc: 'A quivering lump of bog-water and bad temper. It hops, sticks, and splits the unwary.',
    drops: [['crystal', 0.3], ['leather', 0.25], ['wood', 0.2]],
    contact: true,
  },
  ogre: {
    id: 'ogre',
    name: 'Ogre Warden',
    sprite: 123,
    hp: 340,
    damage: 22,
    speed: 30,
    xp: 75,
    gold: [60, 90],
    width: 19,
    height: 20,
    ai: 'ogre',
    threat: 'Mini-boss',
    desc: 'The jailer of Ironhold. Its club is a broken portcullis and its temper is older than the keep.',
    drops: [['iron', 1], ['crystal', 0.7], ['scale', 0.35]],
    contact: false,
    miniBoss: true,
  },
};

export const BOSS = {
  dragon: {
    id: 'dragon',
    name: 'Vaelros, the Ashen Wyrm',
    shortName: 'Vaelros',
    hp: 1100,
    damage: 20,
    xp: 220,
    gold: [220, 300],
    threat: 'Boss',
    desc: 'The last wyrm of Cinderpeak. It has worn a crown of iron, fed on a mountain’s heart, and waited a very long time for heroes.',
    phases: ['PHASE I — THE HUNT', 'PHASE II — THE STORM', 'PHASE III — THE PYRE'],
    sub: ['The mountain breathes. Keep moving.', 'Ash blinds. Watch the sky.', 'Everything burns. End this.'],
  },
};

export const KEYBINDS = [
  { keys: ['A', 'D'], label: 'Move' },
  { keys: ['Space'], label: 'Jump / Double jump', note: '×2' },
  { keys: ['J'], label: 'Attack', note: 'or left click' },
  { keys: ['K'], label: 'Class skill' },
  { keys: ['Shift'], label: 'Dash' },
  { keys: ['E'], label: 'Interact / loot' },
  { keys: ['Q'], label: 'Health potion' },
  { keys: ['I'], label: 'Inventory / satchel' },
  { keys: ['Esc'], label: 'Pause' },
  { keys: ['M'], label: 'Mute audio' },
];

export const GAMEPAD_BINDS = [
  { keys: ['Stick', 'D-pad'], label: 'Move' },
  { keys: ['A'], label: 'Jump' },
  { keys: ['X'], label: 'Attack' },
  { keys: ['Y'], label: 'Skill' },
  { keys: ['B'], label: 'Dash' },
  { keys: ['LB'], label: 'Potion' },
  { keys: ['Start'], label: 'Pause' },
];

// ---------- progression helpers ----------
export function xpToNext(level) {
  if (level >= MAX_LEVEL) return 0;
  return Math.round(72 + (level - 1) * 54);
}

export function upgradeCost(tier, plus) {
  return Math.round((90 + tier * 85 + plus * 65) * (1 + plus * 0.18));
}

export function heroPower(heroId, progress) {
  const cfg = HEROES[heroId];
  const levels = Math.max(1, Math.min(MAX_LEVEL, progress.level || 1));
  const weapon = GEAR[heroId].weapon[Math.max(0, Math.min(2, (progress.weaponTier || 1) - 1))];
  const armor = GEAR[heroId].armor[Math.max(0, Math.min(2, (progress.armorTier || 1) - 1))];
  const wp = Math.max(0, Math.min(MAX_PLUS, progress.weaponPlus || 0));
  const ap = Math.max(0, Math.min(MAX_PLUS, progress.armorPlus || 0));
  const levelDamage = 1 + (levels - 1) * 0.055;
  const damage = Math.round(weapon.dmg * (1 + wp * 0.08) * levelDamage * (cfg.damageMult || 1));
  const crit = Math.min(0.5, weapon.crit + (levels - 1) * 0.002);
  const survival = cfg.survivalMult || 1;
  const maxHp = Math.round((cfg.base.hp + armor.hp + (levels - 1) * 6 + ap * 4) * survival);
  const defense = Math.round((cfg.base.defense + armor.def + ap * 1.5) * survival);
  const speed = cfg.base.speed + (levels - 1) * 0.6;
  return {
    level: levels,
    weapon,
    armor,
    weaponPlus: wp,
    armorPlus: ap,
    damage,
    crit,
    maxHp,
    defense,
    speed,
    skillCooldown: cfg.skill.cooldown,
    attackCooldown: cfg.attack.cooldown * (1 - Math.min(0.18, wp * 0.025)),
  };
}

export function mapUnlocked(save, mapId) {
  const map = MAPS[mapId];
  if (!map.unlock) return true;
  return (save.cleared[map.unlock] || 0) >= 1;
}

export function nextMapId(mapId) {
  const i = MAP_ORDER.indexOf(mapId);
  return i >= 0 && i < MAP_ORDER.length - 1 ? MAP_ORDER[i + 1] : null;
}

export function difficultyUnlocked(save, mapId, difficulty) {
  if (difficulty <= 1) return true;
  const cleared = save.cleared[mapId] || 0;
  if (difficulty === 2) return cleared >= 1;
  return cleared >= 2;
}

export function gearRecipe(heroId, slot, nextTier) {
  const entry = GEAR[heroId][slot].find(g => g.tier === nextTier);
  return entry ? entry.recipe : null;
}

export const DEFAULT_SAVE = () => ({
  version: SAVE_VERSION,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  gold: 0,
  materials: { iron: 0, leather: 0, crystal: 0, wood: 0, scale: 0 },
  activeHero: 'warrior',
  heroes: {
    warrior: { level: 1, xp: 0, weaponTier: 1, weaponPlus: 0, armorTier: 1, armorPlus: 0 },
    mage: { level: 1, xp: 0, weaponTier: 1, weaponPlus: 0, armorTier: 1, armorPlus: 0 },
    archer: { level: 1, xp: 0, weaponTier: 1, weaponPlus: 0, armorTier: 1, armorPlus: 0 },
  },
  cleared: { woods: 0, keep: 0, peak: 0 },
  stats: { runs: 0, victories: 0, kills: 0, bosses: 0, goldEarned: 0, deaths: 0, materialsGathered: 0 },
  settings: { music: 0.5, sfx: 0.75, shake: true, touch: 'auto', reduceMotion: false },
  seenIntro: false,
});

export const CREDITS = [
  {
    title: 'Character, monster & item art',
    body: '<b>Tiny Dungeon</b> by Kenney — CC0 1.0. Knights, mages, rangers, goblins, orcs, ogres and every trinket in the satchel. <a href="https://kenney.nl/assets/tiny-dungeon" target="_blank" rel="noopener">kenney.nl/assets/tiny-dungeon</a>',
  },
  {
    title: 'Terrain, props & effects',
    body: '<b>Pixel Platformer</b> by Kenney — CC0 1.0. Grass, stone, snow, water, trees, banners and loot chests. <a href="https://kenney.nl/assets/pixel-platformer" target="_blank" rel="noopener">kenney.nl/assets/pixel-platformer</a>',
  },
  {
    title: 'Dragon boss',
    body: '<b>Dragons</b> by Blarumyrran (Wesnoth) — CC0 1.0, via OpenGameArt. <a href="https://opengameart.org/content/dragons" target="_blank" rel="noopener">opengameart.org/content/dragons</a>',
  },
  {
    title: 'Typefaces',
    body: '<b>Cinzel</b> and <b>Alegreya Sans</b>, licensed under the SIL Open Font License 1.1, served from Google Fonts. <a href="https://fonts.google.com" target="_blank" rel="noopener">fonts.google.com</a>',
  },
  {
    title: 'Engine & sound',
    body: 'Original HTML5 canvas engine, UI, game design, music and sound synthesis made for Emberfall. No paid assets, no trackers, no network calls at runtime.',
  },
];

export const LORE = {
  intro: [
    'The Cinder Crown held the three realms in balance: dawn over the woods, iron beneath the keep, flame beneath the peak.',
    'When Vaelros the Ashen Wyrm tore it apart, the shards fell to earth — and the earth began to burn.',
    'Three answered the beacon. A knight without a king. A sage without a circle. A ranger without a forest.',
    'Take back the shards. Reforge the crown. End the wyrm.',
  ],
};

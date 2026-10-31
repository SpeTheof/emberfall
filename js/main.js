// ============================================================
// EMBERFALL — boot & wiring
// ============================================================

import { Assets } from './assets.js';
import { AudioEngine } from './audio.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { loadSave, persist, persistNow } from './save.js';
import { DEFAULT_SAVE, HEROES, MAPS, DIFFICULTIES } from './data.js';

const bootScreen = document.getElementById('boot-screen');
const bootFill = document.getElementById('boot-fill');
const bootStatus = document.getElementById('boot-status');

function setBoot(pct, text) {
  if (bootFill) bootFill.style.width = `${Math.round(pct * 100)}%`;
  if (text && bootStatus) bootStatus.textContent = text;
}

function fail(err) {
  console.error(err);
  if (bootStatus) bootStatus.textContent = 'The embers would not catch. Please reload.';
  if (bootFill) bootFill.style.width = '100%';
  const note = document.createElement('p');
  note.style.cssText = 'max-width:420px;text-align:center;color:#c8b58f;font-size:12px;line-height:1.6;padding:0 24px';
  note.textContent = 'If you opened index.html directly, start the local server with start.cmd instead. Browsers block ES modules loaded from disk.';
  bootScreen?.querySelector('.boot-status')?.after(note);
}

function seedDemo(save) {
  save.gold = 1640;
  save.materials = { iron: 26, leather: 18, crystal: 14, wood: 21, scale: 2 };
  save.cleared = { woods: 2, keep: 1, peak: 0 };
  save.heroes.warrior = { level: 4, xp: 42, weaponTier: 2, weaponPlus: 2, armorTier: 2, armorPlus: 1 };
  save.heroes.mage = { level: 3, xp: 30, weaponTier: 2, weaponPlus: 1, armorTier: 1, armorPlus: 2 };
  save.heroes.archer = { level: 2, xp: 12, weaponTier: 1, weaponPlus: 3, armorTier: 1, armorPlus: 1 };
  save.stats = { runs: 14, victories: 9, kills: 187, bosses: 1, goldEarned: 5820, deaths: 5, materialsGathered: 96 };
}

async function boot() {
  setBoot(0.04, 'Kindling the embers…');
  const assets = new Assets();
  const save = loadSave();
  const audio = new AudioEngine(save.settings);

  // debug/demo query flags are useful for previewing screens
  const params = new URLSearchParams(location.search);
  const demo = params.get('demo') === '1';
  if (demo) seedDemo(save);

  let ui;
  const game = new Game({
    canvas: document.getElementById('game-canvas'),
    assets,
    audio,
    save,
    callbacks: {
      onHud: (snap, force) => ui?.updateHud(snap, force),
      onToast: (text) => ui?.gameToast(text),
      onIntro: (info) => ui?.showIntro(info),
      onRunStart: (info) => ui?.onRunStart(info),
      onRunEnd: (result) => ui?.showResults(result),
      onPauseRequest: () => ui?.handlePauseRequest(),
      onInventoryRequest: () => ui?.handleInventoryRequest(),
      onMute: () => ui?.toggleMute(),
    },
  });

  ui = new UI({ assets, save, audio, game });
  window.Emberfall = { assets, save, audio, game, ui, params };

  await assets.load((p) => {
    setBoot(0.08 + p * 0.82, p < 0.5 ? 'Gathering steel and spellbooks…' : p < 0.9 ? 'Lighting the campfires…' : 'Waking the dragon…');
  });
  setBoot(0.94, 'Setting the table…');
  try {
    if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 900))]);
  } catch (e) { /* fonts are optional */ }

  if (params.get('touch') === '1') ui.touchOverride = true;
  ui.init();
  if (save.settings.muted) audio.setMuted(true);
  setBoot(1, 'Ready.');

  setTimeout(() => bootScreen?.classList.add('is-done'), 280);
  setTimeout(() => { if (bootScreen) bootScreen.hidden = true; }, 1200);
  document.body.classList.add('ready');

  // ------------------------------------------------------------
  // debug hooks / deep links
  // ------------------------------------------------------------
  const debug = params.get('debug');
  const map = MAPS[params.get('map')] ? params.get('map') : 'woods';
  const hero = HEROES[params.get('hero')] ? params.get('hero') : save.activeHero;
  const diff = Math.max(1, Math.min(3, Number(params.get('diff')) || 1));

  setTimeout(() => {
    if (debug === 'heroes') {
      ui.openHeroSelect(params.get('mode') === 'new' ? 'new' : 'switch', 'camp');
    } else if (debug === 'camp' || debug === 'forge') {
      ui.campTab = debug === 'forge' ? 'forge' : (params.get('tab') || 'campaign');
      ui.openCamp(ui.campTab);
    } else if (debug === 'codex') {
      ui.openCodex('title', params.get('tab') || 'heroes');
    } else if (debug === 'game') {
      save.activeHero = hero;
      ui.launchRun(map, diff);
      if (params.get('boss') === '1') {
        setTimeout(() => game.debugJumpBoss(), 700);
      }
    } else if (debug === 'results') {
      save.activeHero = hero;
      const victory = params.get('victory') !== '0';
      ui.showResults({
        mapId: map,
        difficulty: diff,
        heroId: hero,
        victory,
        loot: {
          gold: 318,
          materials: { iron: 7, leather: 4, crystal: 3, wood: 6, scale: victory && map === 'peak' ? 3 : 0 },
        },
        kills: 24,
        bossKilled: victory && map === 'peak',
        time: 383,
        xp: 186,
        clearBonus: 0,
      });
    } else if (debug === 'hud') {
      ui.launchRun(map, diff);
    }
  }, 420);

  // ------------------------------------------------------------
  // global niceties
  // ------------------------------------------------------------
  let rotateDismissed = false;
  const rotateHint = document.getElementById('rotate-hint');
  const checkOrientation = () => {
    if (!rotateHint) return;
    const portrait = window.innerHeight > window.innerWidth * 1.08;
    const should = ui.current === 'game' && ui.touchEnabled && portrait && !rotateDismissed;
    rotateHint.hidden = !should;
  };
  document.getElementById('rotate-dismiss')?.addEventListener('click', () => {
    rotateDismissed = true;
    checkOrientation();
  });
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('ember-screen', checkOrientation);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ui.current === 'game' && game.state === 'running' && !game.paused) {
      ui.openPause();
    }
  });

  // stop the browser from zooming the whole page with ctrl+wheel
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  window.addEventListener('error', (e) => {
    console.error('[Emberfall] runtime error', e.error || e.message);
  });
  window.addEventListener('beforeunload', () => persistNow(save));
}

boot().catch(fail);

// ============================================================
// EMBERFALL — interface, screens, camp, HUD & menus
// ============================================================

import {
  HEROES, HERO_ORDER, GEAR, MAPS, MAP_ORDER, MATERIALS, MATERIAL_ORDER,
  DIFFICULTIES, KEYBINDS, GAMEPAD_BINDS, BOSS, ENEMIES, CREDITS, LORE,
  heroPower, upgradeCost, xpToNext, MAX_LEVEL, MAX_PLUS, REGEN,
  mapUnlocked, difficultyUnlocked, nextMapId, DEFAULT_SAVE,
} from './data.js';
import {
  hasProgress, persist, persistNow, upgradeGear, canUpgrade, canCraft,
  craftGear, nextTierFor, recipeFor, clearSummary, wipeSave,
} from './save.js';
import { gearIconHTML, icon } from './icons.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
function mmss(s) {
  s = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function romanPhase(n) { return ['I', 'II', 'III'][Math.max(0, Math.min(2, n - 1))]; }

// ============================================================
// Ember canvas
// ============================================================
class Embers {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = { count: 55, color: [255, 140, 60], ...opts };
    this.particles = [];
    this.raf = null;
    this.last = 0;
    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);
    this.resize();
    window.addEventListener('resize', this.resize);
    this.spawn(1);
    this.start();
  }
  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.max(1, Math.floor(w * dpr));
    this.canvas.height = Math.max(1, Math.floor(h * dpr));
    this.w = w; this.h = h; this.dpr = dpr;
  }
  spawn(initial = 0) {
    const n = initial ? this.opts.count : 1;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: Math.random() * this.w,
        y: this.h + Math.random() * 40,
        vx: (Math.random() - 0.5) * 12,
        vy: -(9 + Math.random() * 26),
        life: 0,
        max: 4 + Math.random() * 5,
        size: 0.7 + Math.random() * 2.2,
        phase: Math.random() * 6,
      });
    }
  }
  start() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }
  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    window.removeEventListener('resize', this.resize);
  }
  tick(now) {
    if (!this.raf) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt + Math.sin(p.life * 1.4 + p.phase) * 6 * dt;
      p.y += p.vy * dt;
      if (p.life > p.max || p.y < -20) { this.particles.splice(i, 1); continue; }
      const t = p.life / p.max;
      const alpha = Math.sin(Math.min(1, t) * Math.PI) * 0.65;
      const [r, g, b] = this.opts.color;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
      grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - p.size * 4, p.y - p.size * 4, p.size * 8, p.size * 8);
      ctx.fillStyle = `rgba(255, 230, 180, ${alpha * 0.75})`;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    if (this.particles.length < this.opts.count) this.spawn(1);
    this.raf = requestAnimationFrame(this.tick);
  }
}

// ============================================================
// UI
// ============================================================
export class UI {
  constructor({ assets, save, audio, game }) {
    this.assets = assets;
    this.save = save;
    this.audio = audio;
    this.game = game;
    this.current = 'title';
    this.heroMode = 'switch';
    this.heroReturn = 'camp';
    this.codexTab = 'heroes';
    this.codexReturn = 'title';
    this.campTab = 'campaign';
    this.mapDifficulty = { woods: 1, keep: 1, peak: 1 };
    this.settings = save.settings;
    this.embers = {};
    this.introTimers = [];
    this.touchEnabled = false;
    this.touchOverride = false;
    this.modalMode = null;
    this.confirmCallback = null;
    this.lastHud = null;
    this.lastBossVisible = false;
    this.skillIconCache = '';
    this.toastTimers = [];
    this.pendingStory = false;
    this.audioHintShown = false;
  }

  init() {
    this.cache();
    this.buildTitle();
    this.bindGlobal();
    this.bindTitle();
    this.bindHeroSelect();
    this.bindCamp();
    this.bindGame();
    this.bindPause();
    this.bindInventory();
    this.bindCodex();
    this.bindModal();
    this.bindTouch();
    this.applySettings();
    this.renderTitle();
    this.showScreen('title');
    this.audio.setMood('title');
    this.startEmbers('title');
    this.assets.hydrateIcons(document);
  }

  cache() {
    this.screens = {
      title: $('#screen-title'),
      heroes: $('#screen-heroes'),
      camp: $('#screen-camp'),
      game: $('#screen-game'),
      results: $('#screen-results'),
      codex: $('#screen-codex'),
    };
    this.campHeroPanel = $('#camp-hero-panel');
    this.campMain = $('.camp-main');
    this.heroCards = $('#hero-cards');
    this.tabCampaign = $('#tab-campaign');
    this.tabForge = $('#tab-forge');
    this.tabHero = $('#tab-hero');
    this.campGold = $('#camp-gold');
    this.campMaterials = $('#camp-materials');
    this.codexBody = $('#codex-body');
    this.modalLayer = $('#modal-layer');
    this.modalTitle = $('#modal-title');
    this.modalBody = $('#modal-body');
    this.pauseMenu = $('#pause-menu');
    this.inventoryMenu = $('#inventory-menu');
    this.bossHud = $('#boss-hud');
    this.interactPrompt = $('#interact-prompt');
    this.gameToasts = $('#game-toasts');
    this.lowHp = $('#low-hp');
    this.touchControls = $('#touch-controls');
    this.mapIntro = $('#map-intro');
    this.storyShown = false;
  }

  // ----------------------------------------------------------
  // screen helpers
  // ----------------------------------------------------------
  showScreen(name) {
    if (!this.screens[name]) return;
    Object.entries(this.screens).forEach(([key, el]) => {
      el.classList.toggle('is-active', key === name);
    });
    this.current = name;
    document.body.classList.toggle('in-game', name === 'game');
    if (name !== 'title') this.stopEmbers('title');
    if (name !== 'results') this.stopEmbers('results');
    if (name === 'title') this.startEmbers('title');
    if (name === 'results') this.startEmbers('results');
    if (name === 'game') this.stopEmbers('title');
    window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent('ember-screen', { detail: name }));
  }

  startEmbers(name) {
    const canvas = name === 'title' ? $('#title-embers') : name === 'results' ? $('#results-embers') : null;
    if (!canvas) return;
    if (this.embers[name]) { this.embers[name].start(); return; }
    this.embers[name] = new Embers(canvas, name === 'title'
      ? { count: 60, color: [255, 142, 64] }
      : { count: 34, color: [240, 184, 96] });
  }

  stopEmbers(name) {
    if (this.embers[name]) {
      this.embers[name].stop();
      delete this.embers[name];
    }
  }

  // ----------------------------------------------------------
  // title
  // ----------------------------------------------------------
  buildTitle() {
    const cast = $('#title-cast');
    if (cast) {
      cast.innerHTML = HERO_ORDER.map(id => {
        const h = HEROES[id];
        return `<div class="cast-figure">
          <img class="pixel" src="${this.assets.heroImg(id)?.src || ''}" alt="">
          <span>${h.short}</span>
        </div>`;
      }).join('');
    }
    const backdrop = $('.title-backdrop');
    if (backdrop && this.assets.dragon && !$('.title-dragon')) {
      const img = document.createElement('img');
      img.className = 'title-dragon pixel';
      img.src = this.assets.dragon.src;
      img.alt = '';
      backdrop.appendChild(img);
    }
    this.assets.hydrateIcons(document);
  }

  renderTitle() {
    const progress = hasProgress(this.save);
    const btn = $('#btn-continue');
    const sub = $('#continue-sub');
    if (progress) {
      btn.disabled = false;
      btn.querySelector('.btn-hero-label').textContent = 'Continue';
      sub.textContent = `${HEROES[this.save.activeHero].short} · ${fmt(this.save.gold)} gold`;
    } else {
      btn.disabled = false;
      btn.querySelector('.btn-hero-label').textContent = 'Begin';
      sub.textContent = 'Choose your champion';
    }
  }

  bindTitle() {
    $('#btn-continue').addEventListener('click', () => {
      this.audio.init(); this.audio.sfx('ui');
      if (hasProgress(this.save)) this.openCamp();
      else this.openHeroSelect('new');
    });
    $('#btn-new').addEventListener('click', () => {
      this.audio.init(); this.audio.sfx('ui');
      if (hasProgress(this.save)) {
        this.confirmModal('Begin a new campaign?', 'This will erase your gold, materials, forged gear, hero levels and map clears. Your settings are kept.', 'Erase & begin', () => {
          this.resetCampaign();
        });
      } else {
        this.openHeroSelect('new');
      }
    });
    $('#btn-codex').addEventListener('click', () => this.openCodex('title', 'heroes'));
    $('#btn-settings').addEventListener('click', () => this.openSettings());
    $('#title-settings').addEventListener('click', () => this.openSettings());
    $('#btn-credits').addEventListener('click', (e) => {
      e.preventDefault();
      this.openCodex('title', 'credits');
    });
  }

  resetCampaign() {
    const fresh = DEFAULT_SAVE();
    const settings = this.save.settings;
    Object.keys(this.save).forEach(k => { delete this.save[k]; });
    Object.assign(this.save, fresh, { settings });
    persistNow(this.save);
    this.mapDifficulty = { woods: 1, keep: 1, peak: 1 };
    this.openHeroSelect('new');
    this.appToast('A new story begins');
  }

  // ----------------------------------------------------------
  // hero select
  // ----------------------------------------------------------
  openHeroSelect(mode = 'switch', from = 'camp') {
    this.heroMode = mode;
    this.heroReturn = from;
    this.renderHeroes();
    this.showScreen('heroes');
  }

  renderHeroes() {
    $('#heroes-gold').textContent = fmt(this.save.gold);
    this.heroCards.innerHTML = HERO_ORDER.map(id => {
      const h = HEROES[id];
      const progress = this.save.heroes[id];
      const power = heroPower(id, progress);
      const weapon = power.weapon;
      const skill = h.skill;
      const active = this.save.activeHero === id;
      const stats = [
        ['HP', h.stats.hp],
        ['Power', h.stats.power],
        ['Speed', h.stats.speed],
      ];
      const gearTier = Math.max(progress.weaponTier, progress.armorTier);
      const weaponIcon = gearIconHTML(weapon.icon, this.assets);
      return `<article class="hero-card ${active ? 'is-active' : ''}" style="--accent:${h.color};--accent-soft:${h.colorSoft};--accent-line:${h.colorLine};--accent-soft-2:${h.color};">
        <div class="hero-card-top">
          <span class="hero-card-badge">${active ? 'ACTIVE' : `TIER ${gearTier}`}</span>
          <div class="hero-portrait-stage">
            <img class="pixel" src="${this.assets.heroImg(id)?.src || ''}" alt="${h.name}">
          </div>
          <p class="hero-role">${h.role}</p>
          <h2 class="hero-name">${h.name}</h2>
          <p class="hero-title">${h.title}</p>
        </div>
        <div class="hero-card-body">
          <p class="hero-blurb">${h.blurb}</p>
          <div class="hero-stats">
            ${stats.map(([label, val]) => `<div class="hero-stat"><span>${label}</span><div class="hero-stat-bar"><span style="width:${val * 20}%"></span></div><b>${val}/5</b></div>`).join('')}
          </div>
          <div class="hero-kit">
            <div class="hero-kit-row">${weaponIcon}<span>${weapon.name}</span><b>· Lv ${progress.level}</b></div>
            <div class="hero-kit-row">${icon(skill.icon === 'whirlwind' ? 'whirlwind' : skill.icon === 'flame' ? 'flame' : 'arrows')}<span>${skill.name}</span><b>· ${skill.cooldown}s</b></div>
          </div>
          <div class="hero-card-foot">
            <span>Level ${progress.level} · ${progress.weaponTier >= 3 && progress.armorTier >= 3 ? 'Mastered' : 'Forging ahead'}</span>
            <span class="swatches"><i class="swatch" style="background:${h.color}"></i><i class="swatch" style="background:${h.colorLine}"></i></span>
          </div>
          <button class="btn ${active ? 'btn-ghost' : 'btn-primary'}" data-pick="${id}">
            ${active ? (this.heroMode === 'new' ? 'Begin as ' + h.short : 'Keep ' + h.short) : (this.heroMode === 'new' ? 'Choose ' + h.short : 'Set as active')}
          </button>
        </div>
      </article>`;
    }).join('');
    this.assets.hydrateIcons(this.heroCards);
  }

  bindHeroSelect() {
    this.heroCards.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-pick]');
      if (!pick) return;
      this.selectHero(pick.dataset.pick);
    });
  }

  selectHero(id) {
    if (!HEROES[id]) return;
    this.save.activeHero = id;
    persist(this.save);
    this.audio.init(); this.audio.sfx('ui');
    if (this.heroMode === 'new') {
      this.showStoryIntro(() => this.openCamp());
    } else {
      this.openCamp();
      this.appToast(`${HEROES[id].name} takes the field`);
    }
  }

  showStoryIntro(after) {
    const body = `<div class="story-modal">
      <p class="story-lead">The Cinder Crown is broken.</p>
      ${LORE.intro.map((line, i) => `<p class="story-line"><span>${String(i + 1).padStart(2, '0')}</span>${line}</p>`).join('')}
      <div class="modal-actions">
        <button class="btn btn-primary" data-story-begin>Take up the crown</button>
      </div>
    </div>`;
    this.openModal('The shards are calling', body);
    this.modalMode = 'story';
    this.storyAfter = after;
    this.modalBody.querySelector('[data-story-begin]').addEventListener('click', () => {
      this.storyAfter = null;
      this.closeModal();
      after?.();
    });
  }

  // ----------------------------------------------------------
  // camp
  // ----------------------------------------------------------
  openCamp(tab) {
    if (tab) this.campTab = tab;
    this.pauseMenu.hidden = true;
    this.inventoryMenu.hidden = true;
    this.renderCamp();
    this.showScreen('camp');
    this.audio.init();
    this.audio.setMood('camp');
  }

  renderCamp() {
    const hero = HEROES[this.save.activeHero];
    const progress = this.save.heroes[this.save.activeHero];
    const power = heroPower(this.save.activeHero, progress);
    this.campGold.textContent = fmt(this.save.gold);
    this.campMaterials.innerHTML = MATERIAL_ORDER.map(id =>
      `<span class="material-chip ${this.save.materials[id] ? '' : 'material-chip--empty'}" title="${MATERIALS[id].name}">
        <img data-mat="${id}" alt=""><b>${fmt(this.save.materials[id])}</b>
      </span>`
    ).join('');
    this.campMaterials.querySelectorAll('img[data-mat]').forEach(img => {
      img.src = this.assets.icons[img.dataset.mat];
    });

    this.campHeroPanel.innerHTML = this.heroPanelHTML(hero, progress, power);
    this.campHeroPanel.style.setProperty('--accent', hero.color);
    this.campHeroPanel.style.setProperty('--accent-soft', hero.colorSoft);
    this.campHeroPanel.style.setProperty('--accent-line', hero.colorLine);
    this.campHeroPanel.style.setProperty('--accent-soft-2', hero.color);
    this.campHeroPanel.querySelector('[data-switch-hero]')?.addEventListener('click', () => this.openHeroSelect('switch', 'camp'));

    this.renderCampaignTab();
    this.renderForgeTab();
    this.renderHeroTab();
    $$('#screen-camp [data-tab]').forEach(tab => {
      tab.classList.toggle('is-active', tab.dataset.tab === this.campTab);
    });
    [this.tabCampaign, this.tabForge, this.tabHero].forEach(panel => {
      panel.classList.toggle('is-active',
        (panel === this.tabCampaign && this.campTab === 'campaign') ||
        (panel === this.tabForge && this.campTab === 'forge') ||
        (panel === this.tabHero && this.campTab === 'hero'));
    });
    this.assets.hydrateIcons($('#screen-camp'));
  }

  heroPanelHTML(hero, progress, power) {
    const xpNeed = xpToNext(progress.level);
    const xpPct = progress.level >= MAX_LEVEL ? 100 : Math.min(100, (progress.xp / Math.max(1, xpNeed)) * 100);
    const weaponTier = GEAR[hero.id].weapon[progress.weaponTier - 1];
    const armorTier = GEAR[hero.id].armor[progress.armorTier - 1];
    return `<div class="hero-panel-art">
        <span class="hero-panel-level">LV ${progress.level}</span>
        <img class="pixel" src="${this.assets.heroImg(hero.id)?.src || ''}" alt="${hero.name}">
      </div>
      <div class="hero-panel-info">
        <h2 class="hero-panel-name">${hero.short}</h2>
        <p class="hero-panel-title">${hero.role} · ${hero.title}</p>
        <div class="hero-panel-bars">
          <div>
            <div class="meter-label"><span>Health</span><span>${power.maxHp}</span></div>
            <div class="meter"><span class="meter-fill" style="width:${Math.min(100, (power.maxHp / 260) * 100)}%"></span></div>
          </div>
          <div>
            <div class="meter-label"><span>Experience</span><span>${progress.level >= MAX_LEVEL ? 'MAX' : `${progress.xp} / ${xpNeed}`}</span></div>
            <div class="meter meter--xp"><span class="meter-fill" style="width:${xpPct}%"></span></div>
          </div>
        </div>
        <div class="hero-panel-gear">
          <div class="gear-line">${gearIconHTML(weaponTier.icon, this.assets)}<b>${weaponTier.name}</b><span class="plus">+${progress.weaponPlus}</span></div>
          <div class="gear-line">${gearIconHTML(armorTier.icon, this.assets)}<b>${armorTier.name}</b><span class="plus">+${progress.armorPlus}</span></div>
        </div>
        <button class="btn btn-ghost btn-small" data-switch-hero>Switch hero</button>
      </div>`;
  }

  renderCampaignTab() {
    const cards = MAP_ORDER.map(id => this.mapCardHTML(id)).join('');
    const cleared = Object.values(this.save.cleared).filter(v => v > 0).length;
    this.tabCampaign.innerHTML = `<div class="section-head">
        <div>
          <p class="eyebrow">THE CAMPAIGN</p>
          <h2>Where the shards fell</h2>
          <p>Every road can be walked again. Old maps still pay gold, materials and experience.</p>
        </div>
        <span class="section-note">${cleared} / 3 shards reclaimed</span>
      </div>
      <div class="map-grid">${cards}</div>
      <p class="forge-footer-note">Higher difficulties unlock after you clear a map. Veteran and Nightmare pay substantially more gold and materials.</p>`;
  }

  mapCardHTML(id) {
    const map = MAPS[id];
    const unlocked = mapUnlocked(this.save, id);
    const cleared = this.save.cleared[id] || 0;
    const diff = this.mapDifficulty[id] || 1;
    const prev = map.unlock ? MAPS[map.unlock].name : '';
    const sprite = map.boss
      ? `<img class="map-thumb-sprite pixel" src="${this.assets.dragon?.src || ''}" alt="">`
      : `<img class="map-thumb-sprite pixel" src="${this.assets.tinyImg(id === 'woods' ? 112 : 123)?.src || ''}" alt="">`;
    const diffChips = DIFFICULTIES.map(d => {
      const open = difficultyUnlocked(this.save, id, d.id);
      return `<button class="diff-chip ${diff === d.id ? 'is-active' : ''}" data-diff="${id}:${d.id}" ${open ? '' : 'disabled'} title="${d.desc}">${d.name}</button>`;
    }).join('');
    const rewardChips = [
      `<span class="reward-chip"><img src="${this.assets.icons.gold}" alt="">Gold</span>`,
      ...map.rewards.map(m => `<span class="reward-chip"><img src="${this.assets.icons[m]}" alt="">${MATERIALS[m].short}</span>`),
    ].join('');
    const clearedLabel = cleared ? `Cleared · ${DIFFICULTIES.find(d => d.id === cleared)?.name || ''}` : '';
    return `<article class="map-card ${unlocked ? '' : 'is-locked'}">
      <div class="map-thumb map-thumb--${map.theme}">
        <div class="map-thumb-ridge"></div>
        <span class="map-thumb-numeral">${map.numeral}</span>
        <span class="map-thumb-tag">${unlocked ? map.threat : 'Sealed'}</span>
        ${sprite}
        ${cleared ? `<span class="map-cleared">${icon('check')} ${clearedLabel}</span>` : ''}
        ${unlocked ? '' : `<div class="map-thumb-lock">${icon('lock')}<span>Clear ${prev} to unlock</span></div>`}
      </div>
      <div class="map-body">
        <div class="map-name-row"><h3 class="map-name">${map.name}</h3><span class="map-level">SHARD ${map.numeral}</span></div>
        <p class="map-desc">${map.desc}</p>
        <div class="map-rewards">${rewardChips}</div>
        <div class="difficulty-row">${diffChips}</div>
        <div class="map-actions">
          <button class="btn btn-primary" data-enter="${id}" ${unlocked ? '' : 'disabled'}>
            ${cleared ? 'Replay map' : 'March forth'}
          </button>
        </div>
      </div>
    </article>`;
  }

  renderForgeTab() {
    const heroId = this.save.activeHero;
    const hero = HEROES[heroId];
    const progress = this.save.heroes[heroId];
    const power = heroPower(heroId, progress);
    const weapon = power.weapon;
    const armor = power.armor;
    const wUp = canUpgrade(this.save, heroId, 'weapon');
    const aUp = canUpgrade(this.save, heroId, 'armor');
    const wRecipe = nextTierFor(this.save, heroId, 'weapon');
    const aRecipe = nextTierFor(this.save, heroId, 'armor');
    const wCraft = canCraft(this.save, heroId, 'weapon');
    const aCraft = canCraft(this.save, heroId, 'armor');

    const slotHTML = (slot, gear, plus, stats, up) => `<div class="gear-slot">
      <div class="gear-icon-box">${gearIconHTML(gear.icon, this.assets)}</div>
      <div>
        <div class="gear-slot-label">${slot === 'weapon' ? 'Weapon' : 'Armour'}</div>
        <div class="gear-slot-name">${gear.name}</div>
        <div class="gear-slot-stats">${stats}</div>
      </div>
      <div class="gear-slot-actions">
        <span class="plus-badge">+${plus} / ${MAX_PLUS}</span>
        <button class="btn btn-ghost upgrade-btn" data-upgrade="${slot}" ${up.ok ? '' : 'disabled'}>
          ${up.maxed ? 'MAX' : `Upgrade · ${fmt(up.cost || 0)}g`}
        </button>
        <span class="upgrade-note">${up.ok ? 'Sharper. Stronger.' : up.reason}</span>
      </div>
    </div>`;

    const recipeHTML = (slot, nextTier, craft) => {
      if (!nextTier) return `<div class="recipe is-owned">
        <div class="recipe-top">${icon('trophy')}<span class="recipe-name">Tier III mastered</span><span class="recipe-tier">Complete</span></div>
        <p class="recipe-desc">There is nothing finer in the camp forge. Keep upgrading with gold.</p>
      </div>`;
      const r = craft.recipe || {};
      const costs = [];
      if (r.gold) costs.push(`<span class="cost-chip ${craft.missing?.gold ? 'is-missing' : ''}"><img src="${this.assets.icons.gold}" alt="">${fmt(r.gold)}</span>`);
      for (const [mat, n] of Object.entries(r)) {
        if (mat === 'gold') continue;
        costs.push(`<span class="cost-chip ${craft.missing?.[mat] ? 'is-missing' : ''}"><img src="${this.assets.icons[mat]}" alt="">${n} ${MATERIALS[mat].short}</span>`);
      }
      const gear = (slot === 'weapon' ? GEAR[heroId].weapon : GEAR[heroId].armor).find(g => g.tier === nextTier);
      return `<div class="recipe ${craft.ok ? 'is-craftable' : ''}">
        <div class="recipe-top">${gearIconHTML(gear.icon, this.assets)}<span class="recipe-name">${gear.name}</span><span class="recipe-tier">Tier ${nextTier}</span></div>
        <p class="recipe-desc">${gear.desc}</p>
        <div class="recipe-costs">${costs.join('')}</div>
        <button class="btn ${craft.ok ? 'btn-primary' : 'btn-ghost'}" data-craft="${slot}" ${craft.ok ? '' : 'disabled'}>
          ${craft.ok ? 'Forge item' : 'Missing materials'}
        </button>
      </div>`;
    };

    this.tabForge.innerHTML = `<div class="section-head">
        <div><p class="eyebrow">THE CAMP FORGE</p><h2>Steel, sinew &amp; ember</h2><p>Spend gold to sharpen what you carry. Spend materials to forge the next tier.</p></div>
        <span class="section-note">${hero.short} · ${fmt(this.save.gold)} gold</span>
      </div>
      <div class="forge-grid">
        <div class="panel forge-panel ornate">
          <h2>Equipped</h2>
          <p class="panel-sub">Every upgrade is permanent on this hero.</p>
          ${slotHTML('weapon', weapon, progress.weaponPlus, `<span>Damage <b>${power.damage}</b></span><span>Crit <b>${Math.round(power.crit * 100)}%</b></span>`, wUp)}
          ${slotHTML('armor', armor, progress.armorPlus, `<span>Health <b>+${armor.hp + progress.armorPlus * 4}</b></span><span>Defence <b>${power.defense}</b></span>`, aUp)}
          <p class="forge-footer-note">Upgrading adds +8% weapon damage or +4 health and +1.5 defence per rank, up to +${MAX_PLUS}.</p>
        </div>
        <div class="panel forge-panel ornate">
          <h2>Next tier</h2>
          <p class="panel-sub">Craft the next piece to unlock higher damage and sharper looks.</p>
          <div class="recipe-list">
            ${recipeHTML('weapon', wRecipe, wCraft)}
            ${recipeHTML('armor', aRecipe, aCraft)}
          </div>
        </div>
      </div>`;
    this.assets.hydrateIcons(this.tabForge);
  }

  renderHeroTab() {
    const id = this.save.activeHero;
    const hero = HEROES[id];
    const progress = this.save.heroes[id];
    const power = heroPower(id, progress);
    const stats = [
      ['Level', progress.level],
      ['Experience', progress.level >= MAX_LEVEL ? 'MAX' : `${progress.xp} / ${xpToNext(progress.level)}`],
      ['Max health', power.maxHp],
      ['Attack damage', power.damage],
      ['Defence', power.defense],
      ['Critical chance', `${Math.round(power.crit * 100)}%`],
      ['Move speed', Math.round(power.speed)],
      ['Skill cooldown', `${power.skillCooldown}s`],
    ];
    const storyStats = [
      ['Runs', this.save.stats.runs],
      ['Victories', this.save.stats.victories],
      ['Enemies felled', this.save.stats.kills],
      ['Bosses slain', this.save.stats.bosses],
      ['Gold earned', this.save.stats.goldEarned],
      ['Materials gathered', this.save.stats.materialsGathered],
    ];
    this.tabHero.innerHTML = `<div class="section-head">
        <div><p class="eyebrow">THE HERO</p><h2>${hero.name}</h2><p>${hero.title} · ${hero.role}</p></div>
        <button class="btn btn-ghost btn-small" data-switch-hero>Switch hero</button>
      </div>
      <div class="journal-grid">
        <div class="panel journal-panel ornate">
          <h3>Battle record</h3>
          ${stats.map(([k, v]) => `<div class="stat-line"><span>${k}</span><b>${v}</b></div>`).join('')}
        </div>
        <div class="panel journal-panel ornate">
          <h3>Class skill</h3>
          <div class="skill-card">
            <div class="skill-card-orb">${icon(hero.skill.icon === 'whirlwind' ? 'whirlwind' : hero.skill.icon === 'flame' ? 'flame' : 'arrows')}</div>
            <div>
              <h3>${hero.skill.name}</h3>
              <p>${hero.skill.desc}</p>
              <div class="skill-meta"><span>Cooldown ${hero.skill.cooldown}s</span><span>Key K</span></div>
            </div>
          </div>
          <blockquote class="lore-quote">${hero.lore}<span class="lore-source">— Emberfall chronicles</span></blockquote>
        </div>
        <div class="panel journal-panel ornate">
          <h3>Journey so far</h3>
          ${storyStats.map(([k, v]) => `<div class="stat-line"><span>${k}</span><b>${fmt(v)}</b></div>`).join('')}
        </div>
        <div class="panel journal-panel ornate">
          <h3>Controls</h3>
          <div class="key-list">
            ${KEYBINDS.map(b => `<span>${b.keys.map(k => `<span class="keycap">${k}</span>`).join('')} ${b.label}</span>`).join('')}
          </div>
          <p class="forge-footer-note">On touch devices, the joystick and action buttons appear in-game. Double-jump is available to every hero.</p>
        </div>
      </div>`;
  }

  bindCamp() {
    $('#screen-camp').addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) {
        this.campTab = tab.dataset.tab;
        this.renderCamp();
        this.audio.sfx('ui');
        return;
      }
      const diff = e.target.closest('[data-diff]');
      if (diff) {
        const [mapId, d] = diff.dataset.diff.split(':');
        if (!difficultyUnlocked(this.save, mapId, Number(d))) return;
        this.mapDifficulty[mapId] = Number(d);
        this.renderCampaignTab();
        this.audio.sfx('ui');
        return;
      }
      const enter = e.target.closest('[data-enter]');
      if (enter) {
        const mapId = enter.dataset.enter;
        if (!mapUnlocked(this.save, mapId)) return;
        this.launchRun(mapId, this.mapDifficulty[mapId] || 1);
        return;
      }
      const up = e.target.closest('[data-upgrade]');
      if (up) {
        const res = upgradeGear(this.save, this.save.activeHero, up.dataset.upgrade);
        if (res.ok) {
          this.audio.sfx('levelup');
          this.appToast(`${up.dataset.upgrade === 'weapon' ? 'Weapon' : 'Armour'} upgraded to +${res.plus}`);
          this.renderCamp();
        } else {
          this.appToast(res.reason || 'Cannot upgrade');
        }
        return;
      }
      const switchHero = e.target.closest('[data-switch-hero]');
      if (switchHero) {
        this.openHeroSelect('switch', 'camp');
        return;
      }
      const craft = e.target.closest('[data-craft]');
      if (craft) {
        const res = craftGear(this.save, this.save.activeHero, craft.dataset.craft);
        if (res.ok) {
          this.audio.sfx('levelup');
          const gear = (craft.dataset.craft === 'weapon' ? GEAR[this.save.activeHero].weapon : GEAR[this.save.activeHero].armor).find(g => g.tier === res.tier);
          this.appToast(`Forged: ${gear?.name || 'new gear'}`);
          this.renderCamp();
        } else {
          this.appToast(res.reason || 'Missing materials');
        }
      }
    });

    $('#camp-settings').addEventListener('click', () => this.openSettings());
    $('#camp-codex').addEventListener('click', () => this.openCodex('camp', 'heroes'));
    $('#camp-to-title').addEventListener('click', () => {
      this.renderTitle();
      this.showScreen('title');
      this.audio.setMood('title');
    });
    $('#camp-home').addEventListener('click', (e) => { e.preventDefault(); this.openCamp('campaign'); });
  }

  // ----------------------------------------------------------
  // launch / run
  // ----------------------------------------------------------
  launchRun(mapId, difficulty) {
    this.audio.init();
    this.audio.sfx('ui');
    this.lastRunConfig = { mapId, difficulty };
    this.showScreen('game');
    this.resetGameHud();
    this.game.startRun({
      heroId: this.save.activeHero,
      mapId,
      difficulty,
      seed: Math.floor(Math.random() * 1e9),
    });
  }

  onRunStart(info) {
    this.renderTitle();
    this.resetGameHud();
    this.audio.setMood('battle');
  }

  resetGameHud() {
    this.bossHud.hidden = true;
    this.interactPrompt.hidden = true;
    this.lowHp.classList.remove('is-on');
    this.gameToasts.innerHTML = '';
    this.mapIntro.classList.remove('is-visible', 'is-leaving');
    this.pauseMenu.hidden = true;
    this.inventoryMenu.hidden = true;
    this.lastBossVisible = false;
    this.lastHud = null;
    $$('#touch-controls .touch-btn').forEach(b => b.classList.remove('is-cooling', 'is-pressed'));
  }

  showIntro(info) {
    const map = info.map;
    this.introTimers.forEach(t => clearTimeout(t));
    this.introTimers = [];
    $('#intro-numeral').textContent = map.numeralWord;
    $('#intro-title').textContent = map.name;
    $('#intro-sub').textContent = map.introSub;
    $('#intro-hint').textContent = this.touchEnabled
      ? 'Left stick to move · tap Jump, Attack and Skill'
      : 'A / D move · Space jump twice · J attack · K skill · Q potion';
    this.mapIntro.classList.add('is-visible');
    this.mapIntro.classList.remove('is-leaving');
    this.introTimers.push(setTimeout(() => this.mapIntro.classList.add('is-leaving'), 1650));
    this.introTimers.push(setTimeout(() => {
      this.mapIntro.classList.remove('is-visible', 'is-leaving');
    }, 2250));
  }

  // ----------------------------------------------------------
  // HUD
  // ----------------------------------------------------------
  bindGame() {
    $('#hud-pause').addEventListener('click', () => this.openPause());
    $('#hud-inventory').addEventListener('click', () => this.toggleInventory());
    $('#hud-sound').addEventListener('click', () => this.toggleMute());
    $('#hud-potions')?.closest('.hud-chip')?.addEventListener('click', () => this.game.usePotion());
    $('#skill-orb')?.addEventListener('click', () => this.game.doSkill());
  }

  updateHud(snap) {
    if (!snap) return;
    this.lastHud = snap;
    const hero = HEROES[snap.heroId];
    const port = $('#hud-portrait');
    if (port && port.getAttribute('src') !== (this.assets.heroImg(snap.heroId)?.src || '')) {
      port.src = this.assets.heroImg(snap.heroId)?.src || '';
    }
    $('#hud-hero-name').textContent = snap.shortName || hero.short;
    $('#hud-level').textContent = `LV ${snap.level}`;
    const hpPct = Math.max(0, Math.min(100, (snap.hp / Math.max(1, snap.maxHp)) * 100));
    $('#hud-hp-fill').style.width = `${hpPct}%`;
    $('#hud-hp-text').textContent = `${snap.hp} / ${snap.maxHp}`;
    $('#hud-gold').textContent = fmt(snap.gold);
    $('#hud-potions').textContent = snap.potions;
    const regenChip = $('#hud-regen');
    if (regenChip) regenChip.hidden = !snap.regen;
    const soundBtn = $('#hud-sound');
    if (soundBtn) soundBtn.classList.toggle('is-muted', this.audio.muted);
    const touchPotions = $('#touch-potions');
    if (touchPotions) touchPotions.textContent = snap.potions;
    this.lowHp.classList.toggle('is-on', hpPct <= 30);

    $('#hud-objective-label').textContent = `${snap.mapNumeral} · ${snap.mapName}`;
    $('#hud-progress-text').textContent = `${Math.round(snap.progress * 100)}%`;
    $('#hud-progress-fill').style.width = `${Math.round(snap.progress * 100)}%`;
    $('#hud-objective-sub').textContent = snap.objective;

    const skillName = $('#skill-name');
    if (skillName) skillName.textContent = snap.skillName;
    const remaining = Math.max(0, snap.skillRemaining || 0);
    const cooling = remaining > 0.15;
    const widget = $('#skill-widget');
    if (widget) {
      widget.classList.toggle('is-cooling', cooling);
      widget.classList.toggle('is-ready', !cooling);
      $('#skill-cd').textContent = cooling ? Math.ceil(remaining) : '';
      $('#skill-state').textContent = cooling ? `Cooling · ${Math.ceil(remaining)}s` : 'Ready';
    }
    if (this.skillIconCache !== snap.skillIcon) {
      this.skillIconCache = snap.skillIcon;
      $('#skill-icon').innerHTML = icon(snap.skillIcon === 'whirlwind' ? 'whirlwind' : snap.skillIcon === 'flame' ? 'flame' : 'arrows').replace(/^<svg[^>]*>|<\/svg>$/g, '');
      $('#touch-skill-icon').innerHTML = $('#skill-icon').innerHTML;
    }
    const touchSkill = $('[data-touch="skill"]');
    if (touchSkill) {
      touchSkill.classList.toggle('is-cooling', cooling);
      $('#touch-skill-cd').textContent = cooling ? Math.ceil(remaining) : '';
    }

    if (snap.interact) {
      $('#interact-text').textContent = snap.interact;
      $('#interact-key').textContent = this.touchEnabled ? 'PK' : 'E';
      this.interactPrompt.hidden = false;
    } else {
      this.interactPrompt.hidden = true;
    }

    const boss = snap.boss;
    if (boss) {
      this.bossHud.hidden = false;
      $('#boss-name').textContent = boss.name;
      $('#boss-phase').textContent = `PHASE ${romanPhase(boss.phase)}`;
      $('#boss-fill').style.width = `${Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100))}%`;
      $('#boss-sub').textContent = boss.sub;
      this.lastBossVisible = true;
    } else {
      this.bossHud.hidden = true;
      this.lastBossVisible = false;
    }
  }

  gameToast(text) {
    if (!text) return;
    const el = document.createElement('div');
    el.className = 'game-toast';
    el.textContent = text;
    this.gameToasts.appendChild(el);
    while (this.gameToasts.children.length > 3) this.gameToasts.firstElementChild.remove();
    setTimeout(() => el.remove(), 1900);
  }

  appToast(text) {
    let host = $('#app-toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'app-toasts';
      host.className = 'app-toasts';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = 'game-toast';
    el.textContent = text;
    host.appendChild(el);
    while (host.children.length > 3) host.firstElementChild.remove();
    setTimeout(() => el.remove(), 2200);
  }

  // ----------------------------------------------------------
  // pause
  // ----------------------------------------------------------
  bindPause() {
    $('#pause-resume').addEventListener('click', () => this.closePause());
    $('#pause-restart').addEventListener('click', () => {
      this.closePause();
      if (this.lastRunConfig) this.launchRun(this.lastRunConfig.mapId, this.lastRunConfig.difficulty);
    });
    $('#pause-settings').addEventListener('click', () => this.openSettings());
    $('#pause-abandon').addEventListener('click', () => {
      this.confirmModal('Abandon this run?', 'You keep the gold, materials and experience you have gathered. The map will not count as cleared.', 'Abandon run', () => {
        this.pauseMenu.hidden = true;
        this.game.abandonRun();
      });
    });
  }

  openPause() {
    if (!this.game || this.game.state !== 'running') return;
    this.game.pause();
    this.pauseMenu.hidden = false;
    const snap = this.lastHud || {};
    $('#pause-stats').innerHTML = `
      <div><b>${snap.mapName || MAPS[this.game.config.mapId].name}</b>${snap.difficulty || 'Normal'}</div>
      <div><b>${snap.shortName || 'Hero'}</b>Level ${snap.level || 1}</div>
      <div><b>${mmss(this.game.run.time)}</b>Run time</div>
      <div><b>${fmt(this.game.run.gold)}</b>Gold carried</div>`;
    $('#pause-control-grid').innerHTML = KEYBINDS.map(b =>
      `<span>${b.keys.map(k => `<span class="keycap">${k}</span>`).join('')} ${b.label}</span>`
    ).join('');
  }

  closePause() {
    this.pauseMenu.hidden = true;
    if (this.game.state === 'running') this.game.resume();
  }

  // ----------------------------------------------------------
  // in-run inventory
  // ----------------------------------------------------------
  bindInventory() {
    $('#inventory-close').addEventListener('click', () => this.closeInventory());
    $('#inventory-resume').addEventListener('click', () => this.closeInventory());
    this.inventoryMenu.addEventListener('click', (e) => {
      if (e.target === this.inventoryMenu) this.closeInventory();
    });
  }

  toggleInventory() {
    if (!this.inventoryMenu.hidden) this.closeInventory();
    else this.openInventory();
  }

  openInventory() {
    if (this.current !== 'game' || !this.game || this.game.state !== 'running') return;
    if (!this.modalLayer.hidden || !this.inventoryMenu.hidden) return;
    if (!this.pauseMenu.hidden) this.pauseMenu.hidden = true;
    this.renderInventory();
    this.game.pause();
    this.inventoryMenu.hidden = false;
    this.audio.sfx('ui');
    $('#inventory-close').focus();
  }

  closeInventory() {
    if (this.inventoryMenu.hidden) return;
    this.inventoryMenu.hidden = true;
    this.audio.sfx('ui');
    if (this.game.state === 'running') this.game.resume();
  }

  handleInventoryRequest() {
    if (this.current !== 'game') return;
    if (!this.modalLayer.hidden) { this.closeModal(); return; }
    if (!this.inventoryMenu.hidden) { this.closeInventory(); return; }
    this.openInventory();
  }

  renderInventory() {
    const g = this.game;
    if (!g || !g.hero || !g.power || !g.player || !g.run) return;
    const hero = g.hero;
    const power = g.power;
    const p = g.player;
    const map = MAPS[g.config.mapId];
    const run = g.run;
    const card = this.inventoryMenu.querySelector('.inventory-card');
    card.style.setProperty('--accent-soft', hero.colorSoft);
    card.style.setProperty('--accent-line', hero.colorLine);

    $('#inv-hero').innerHTML = `
      <div class="inv-portrait"><img class="pixel" src="${this.assets.heroImg(hero.id)?.src || ''}" alt=""></div>
      <div class="inv-hero-copy">
        <h3>${hero.name}</h3>
        <p>${hero.title} &middot; Level ${power.level} &middot; ${map.name} &middot; ${g.difficulty.name}</p>
      </div>
      <div class="inv-hero-stats">
        <div><span>Health</span><b>${Math.ceil(p.hp)} / ${p.maxHp}</b></div>
        <div><span>Damage</span><b>${power.damage}</b></div>
        <div><span>Defense</span><b>${power.defense}</b></div>
        <div><span>Crit</span><b>${Math.round(power.crit * 100)}%</b></div>
      </div>`;

    $('#inv-materials').innerHTML = MATERIAL_ORDER.map(id => {
      const carried = run.materials[id] || 0;
      const banked = this.save.materials[id] || 0;
      return `<div class="inv-mat-row">
        <img src="${this.assets.icons[id]}" alt="">
        <span class="inv-mat-name">${MATERIALS[id].name}</span>
        <b class="inv-mat-run ${carried ? '' : 'is-zero'}">${carried ? `+${fmt(carried)}` : '0'}</b>
        <span class="inv-mat-bank">${fmt(banked)}</span>
      </div>`;
    }).join('');

    const gearCard = (gear, slot, plus) => `
      <div class="inv-gear-card">
        <div class="inv-gear-icon">${gearIconHTML(gear.icon, this.assets)}</div>
        <div>
          <span class="inv-slot">${slot} &middot; Tier ${gear.tier}${plus ? ` &middot; +${plus}` : ''}</span>
          <strong>${gear.name}</strong>
          <p>${gear.desc}</p>
        </div>
      </div>`;
    $('#inv-equipment').innerHTML =
      gearCard(power.weapon, 'Weapon', power.weaponPlus) +
      gearCard(power.armor, 'Armor', power.armorPlus);

    $('#inv-supplies').innerHTML = `
      <div class="inv-supply-row"><span>Gold carried</span><b>${fmt(run.gold)}</b></div>
      <div class="inv-supply-row"><span>Gold at camp</span><b>${fmt(this.save.gold)}</b></div>
      <div class="inv-supply-row"><span>Health potions</span><b>${p.potions}</b></div>
      <div class="inv-supply-row"><span>Health regen</span><b>${g.hero.id === 'warrior' ? `${(REGEN.rate * 100).toFixed(1)}% /s · always` : `${(REGEN.rate * 100).toFixed(1)}% /s after ${REGEN.delay}s`}</b></div>
      <div class="inv-supply-row"><span>Class skill</span><b>${hero.skill.name}</b></div>
      <div class="inv-supply-row"><span>Run time</span><b>${mmss(run.time)}</b></div>`;
  }

  handlePauseRequest() {
    if (this.current !== 'game') return;
    if (!this.modalLayer.hidden) { this.closeModal(); return; }
    if (!this.inventoryMenu.hidden) { this.closeInventory(); return; }
    if (!this.pauseMenu.hidden) this.closePause();
    else this.openPause();
  }

  toggleMute() {
    this.audio.init();
    const muted = this.audio.toggleMute();
    $('#hud-sound').classList.toggle('is-muted', muted);
    this.appToast(muted ? 'Sound muted' : 'Sound on');
    this.save.settings.muted = muted;
    persist(this.save);
  }

  // ----------------------------------------------------------
  // results
  // ----------------------------------------------------------
  showResults(result) {
    this.pauseMenu.hidden = true;
    this.inventoryMenu.hidden = true;
    this.mapIntro.classList.remove('is-visible', 'is-leaving');
    this.showScreen('results');
    const prevCleared = this.save.cleared[result.mapId] || 0;
    this.save.activeHero = result.heroId;
    const summary = clearSummary(this.save, result);
    const map = MAPS[result.mapId];
    const hero = HEROES[result.heroId];
    const progress = this.save.heroes[result.heroId];
    const power = heroPower(result.heroId, progress);
    const victory = result.victory;
    const nextId = nextMapId(result.mapId);
    const nextUnlocked = nextId ? mapUnlocked(this.save, nextId) : false;
    const banner = $('#results-banner');
    banner.classList.toggle('is-defeat', !victory);
    $('#results-kicker').textContent = victory ? 'SHARD RECLAIMED' : result.abandoned ? 'RUN ABANDONED' : 'THE EMBERS GUTTER';
    $('#results-title').textContent = victory ? 'Victory' : result.abandoned ? 'Camp Awaits' : 'Fallen';
    $('#results-sub').textContent = victory ? map.victory : result.abandoned ? 'You return with what you carry. The road remains.' : map.defeat;
    $('#result-hero').innerHTML = `<div class="result-hero-img"><img class="pixel" src="${this.assets.heroImg(result.heroId)?.src || ''}" alt=""></div>
      <div><div class="result-hero-name">${hero.name}</div>
      <div class="result-hero-meta">${map.name} · ${summary.diff.name} · ${mmss(result.time)}</div></div>
      <span class="result-hero-badge">${victory ? 'Cleared' : result.abandoned ? 'Retreated' : 'Defeated'}</span>`;
    $('#result-stats').innerHTML = `
      <div class="result-stat"><b>${summary.kills}</b><span>Foes felled</span></div>
      <div class="result-stat"><b>${mmss(result.time)}</b><span>Run time</span></div>
      <div class="result-stat"><b>${fmt(summary.gold)}</b><span>Gold earned</span></div>
      <div class="result-stat"><b>${fmt(summary.xp)}</b><span>Experience</span></div>`;

    const loot = [];
    loot.push(`<span class="loot-item loot-item--gold"><img src="${this.assets.icons.gold}" alt="">+${fmt(summary.gold)} gold</span>`);
    for (const [mat, count] of Object.entries(summary.materials || {})) {
      if (count > 0) loot.push(`<span class="loot-item"><img src="${this.assets.icons[mat]}" alt="">+${count} ${MATERIALS[mat].short}</span>`);
    }
    if (!loot.length) loot.push('<span class="loot-item">Nothing recovered</span>');
    $('#result-loot-list').innerHTML = loot.join('');

    const level = progress.level;
    const need = xpToNext(level);
    const pct = level >= MAX_LEVEL ? 100 : (progress.xp / Math.max(1, need)) * 100;
    $('#result-level-label').textContent = level >= MAX_LEVEL ? 'Level MAX' : `Level ${level}`;
    $('#result-xp-label').textContent = level >= MAX_LEVEL ? 'MAX' : `${progress.xp} / ${need} XP`;
    $('#result-xp-fill').style.width = `${pct}%`;
    const existingBurst = $('.levelup-burst');
    if (existingBurst) existingBurst.remove();
    if (summary.leveled > 0) {
      const burst = document.createElement('div');
      burst.className = 'levelup-burst';
      burst.innerHTML = `${icon('spark')} Level up! ${hero.short} reached level ${level}.`;
      $('.result-xp').appendChild(burst);
    }

    const side = [];
    if (victory) {
      if (nextId && nextUnlocked) {
        side.push(`<p>${MAPS[nextId].name} is open. Its roads are longer, its foes crueller, and its spoils richer.</p>`);
        side.push(`<div class="side-list">
          <div class="side-list-item">${icon('map')}<span><b>${MAPS[nextId].name}</b><br>${MAPS[nextId].desc}</span></div>
          <div class="side-list-item">${icon('spark')}<span>Replaying a cleared map still pays full gold, materials and experience.</span></div>
        </div>`);
      } else if (result.mapId === 'peak') {
        side.push(`<p>The Cinder Crown is whole. All three shards are yours — but the roads remain open, and the forge is hungry.</p>`);
        side.push(`<div class="side-list">
          <div class="side-list-item">${icon('trophy')}<span><b>The crown is reforged.</b><br>Every map can be replayed at higher difficulty for rarer spoils.</span></div>
          <div class="side-list-item">${icon('spark')}<span>Dragon scales remain the rarest material. Nightmare clears offer the richest hunts.</span></div>
        </div>`);
      } else {
        side.push(`<p>Every map is still open for another hunt. Higher difficulties await.</p>`);
      }
      if (prevCleared < summary.diff.id) {
        const nextDiff = DIFFICULTIES.find(d => d.id === Math.min(3, summary.diff.id + 1));
        side.push(`<div class="levelup-burst">${icon('check')} ${summary.diff.name} cleared — ${nextDiff && nextDiff.id > summary.diff.id ? `${nextDiff.name} unlocked` : 'every difficulty conquered'}</div>`);
      }
    } else {
      side.push(`<div class="side-list">
        <div class="side-list-item">${icon('armor')}<span><b>Spend your gold.</b><br>Weapon and armour upgrades are permanent and make a visible difference.</span></div>
        <div class="side-list-item">${icon('potion')}<span><b>Carry two potions.</b><br>Press Q or tap the flask. They heal 45% of your maximum health.</span></div>
        <div class="side-list-item">${icon('star')}<span><b>Use your skill.</b><br>K is a free burst of damage every ${HEROES[result.heroId].skill.cooldown} seconds. Use it on cooldown.</span></div>
        <div class="side-list-item">${icon('map')}<span><b>Materials persist.</b><br>Even a failed run keeps the gold and materials you gathered.</span></div>
      </div>`);
    }
    $('#results-side-title').textContent = victory ? 'The road ahead' : 'Before you march again';
    $('#results-side-content').innerHTML = side.join('');

    const replay = $('#results-replay');
    const next = $('#results-next');
    replay.onclick = () => this.launchRun(result.mapId, result.difficulty);
    $('#results-camp').onclick = () => this.openCamp('campaign');
    if (nextId && victory) {
      next.hidden = false;
      next.onclick = () => this.launchRun(nextId, 1);
    } else {
      next.hidden = true;
    }
    this.audio.setMood(victory ? 'victory' : 'defeat');
    this.assets.hydrateIcons($('#screen-results'));
  }

  // ----------------------------------------------------------
  // codex
  // ----------------------------------------------------------
  openCodex(from = 'title', tab = 'heroes') {
    this.codexReturn = from;
    this.codexTab = tab;
    this.showScreen('codex');
    $$('#screen-codex [data-codex]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.codex === tab));
    this.renderCodex(tab);
  }

  bindCodex() {
    $('#screen-codex').addEventListener('click', (e) => {
      const tab = e.target.closest('[data-codex]');
      if (!tab) return;
      this.codexTab = tab.dataset.codex;
      $$('#screen-codex [data-codex]').forEach(b => b.classList.toggle('is-active', b === tab));
      this.renderCodex(this.codexTab);
      this.audio.sfx('ui');
    });
  }

  renderCodex(tab) {
    if (tab === 'heroes') {
      this.codexBody.innerHTML = `<div class="codex-hero-grid">${HERO_ORDER.map(id => {
        const h = HEROES[id];
        return `<article class="panel codex-card ornate">
          <div class="codex-card-img"><img class="pixel" src="${this.assets.heroImg(id)?.src || ''}" alt=""></div>
          <p class="sub">${h.role}</p><h3>${h.name}</h3>
          <p>${h.blurb}</p>
          <div class="skill-meta"><span>HP ${h.stats.hp}/5</span><span>Power ${h.stats.power}/5</span><span>Speed ${h.stats.speed}/5</span></div>
        </article>`;
      }).join('')}</div>`;
    } else if (tab === 'bestiary') {
      const beasts = Object.values(ENEMIES);
      this.codexBody.innerHTML = `<div class="bestiary-grid">
        ${beasts.map(e => `<article class="panel beast-card">
          <img class="pixel" src="${this.assets.tinyImg(e.sprite)?.src || ''}" alt="">
          <div><h4>${e.name}</h4><p>${e.desc}</p><div class="threat">${e.threat}</div></div>
        </article>`).join('')}
        <article class="panel beast-card">
          <img class="pixel" src="${this.assets.dragon?.src || ''}" alt="">
          <div><h4>${BOSS.dragon.name}</h4><p>${BOSS.dragon.desc}</p><div class="threat">Boss · Cinderpeak</div></div>
        </article>
      </div>`;
    } else if (tab === 'controls') {
      this.codexBody.innerHTML = `<div class="panel codex-controls">
        ${KEYBINDS.map(b => `<div class="control-row"><span>${b.label}${b.note ? ` <em>${b.note}</em>` : ''}</span><span class="keys">${b.keys.map(k => `<span class="keycap">${k}</span>`).join('')}</span></div>`).join('')}
        <div class="control-row"><span>Gamepad</span><span class="keys">${GAMEPAD_BINDS.map(b => `<span class="keycap">${b.keys[0]}</span>`).join('')}</span></div>
      </div>
      <div class="panel codex-controls" style="margin-top:12px">
        ${GAMEPAD_BINDS.map(b => `<div class="control-row"><span>${b.label}</span><span class="keys">${b.keys.map(k => `<span class="keycap">${k}</span>`).join('')}</span></div>`).join('')}
      </div>`;
    } else {
      this.codexBody.innerHTML = `<div class="panel credits-block">
        ${CREDITS.map(c => `<div class="credit-row"><h4>${c.title}</h4><p>${c.body}</p></div>`).join('')}
      </div>`;
    }
    this.assets.hydrateIcons(this.codexBody);
  }

  // ----------------------------------------------------------
  // modal & settings
  // ----------------------------------------------------------
  bindModal() {
    $('#modal-close').addEventListener('click', () => this.closeModal());
    $('.modal-scrim').addEventListener('click', () => this.closeModal());
    this.modalBody.addEventListener('click', (e) => {
      if (e.target.closest('[data-confirm-yes]')) {
        const fn = this.confirmCallback;
        this.confirmCallback = null;
        this.closeModal();
        fn?.();
      } else if (e.target.closest('[data-confirm-no]')) {
        this.confirmCallback = null;
        this.closeModal();
      }
    });
  }

  openModal(title, bodyHTML) {
    this.modalTitle.textContent = title;
    this.modalBody.innerHTML = bodyHTML;
    this.modalLayer.hidden = false;
    this.modalMode = 'custom';
    this.assets.hydrateIcons(this.modalBody);
    setTimeout(() => $('#modal-close')?.focus(), 20);
  }

  closeModal() {
    this.modalLayer.hidden = true;
    this.modalBody.innerHTML = '';
    this.modalMode = null;
    this.confirmCallback = null;
    if (this.storyAfter) {
      const after = this.storyAfter;
      this.storyAfter = null;
      setTimeout(after, 20);
    }
  }

  confirmModal(title, message, label, onConfirm) {
    this.confirmCallback = onConfirm;
    this.openModal(title, `<p class="modal-note">${message}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-confirm-no>Not now</button>
        <button class="btn btn-primary danger-btn" data-confirm-yes>${label}</button>
      </div>`);
    this.modalMode = 'confirm';
  }

  openSettings() {
    const s = this.save.settings;
    const touch = s.touch || 'auto';
    this.openModal('Settings', `
      <p class="modal-note">Preferences save automatically on this device.</p>
      <div class="setting-row">
        <div class="setting-row-label"><b>Music</b><span>The campfire and the battle drums.</span></div>
        <div class="setting-control"><input type="range" id="set-music" min="0" max="100" value="${Math.round((s.music ?? 0.5) * 100)}"></div>
      </div>
      <div class="setting-row">
        <div class="setting-row-label"><b>Effects</b><span>Steel, spells and everything that breaks.</span></div>
        <div class="setting-control"><input type="range" id="set-sfx" min="0" max="100" value="${Math.round((s.sfx ?? 0.75) * 100)}"></div>
      </div>
      <div class="setting-row">
        <div class="setting-row-label"><b>Test audio</b><span>Play a short chime through the current mix.</span></div>
        <div class="setting-control"><button class="btn btn-ghost" id="settings-test-audio">Test sound</button></div>
      </div>
      <div class="setting-row">
        <div class="setting-row-label"><b>Screen shake</b><span>Camera kick on heavy hits and boss slams.</span></div>
        <div class="setting-control"><input type="checkbox" id="set-shake" ${s.shake ? 'checked' : ''}></div>
      </div>
      <div class="setting-row">
        <div class="setting-row-label"><b>Touch controls</b><span>Auto detects a touch device. Force them on to test.</span></div>
        <div class="setting-control"><div class="segmented" id="set-touch">
          <button data-touch-setting="auto" class="${touch === 'auto' ? 'is-active' : ''}">Auto</button>
          <button data-touch-setting="on" class="${touch === 'on' ? 'is-active' : ''}">On</button>
          <button data-touch-setting="off" class="${touch === 'off' ? 'is-active' : ''}">Off</button>
        </div></div>
      </div>
      <div class="setting-row">
        <div class="setting-row-label"><b>Reduce motion</b><span>Calms ambient particles and screen effects.</span></div>
        <div class="setting-control"><input type="checkbox" id="set-reduce" ${s.reduceMotion ? 'checked' : ''}></div>
      </div>
      <div class="modal-actions" style="justify-content:space-between">
        <button class="btn btn-ghost danger-btn" id="settings-reset">Reset progress</button>
        <button class="btn btn-primary" id="settings-done">Done</button>
      </div>
    `);
    this.modalMode = 'settings';

    $('#set-music').addEventListener('input', (e) => {
      this.save.settings.music = Number(e.target.value) / 100;
      this.audio.setVolumes({ music: this.save.settings.music });
      persist(this.save);
    });
    $('#set-sfx').addEventListener('input', (e) => {
      this.save.settings.sfx = Number(e.target.value) / 100;
      this.audio.setVolumes({ sfx: this.save.settings.sfx });
      persist(this.save);
    });
    $('#settings-test-audio').addEventListener('click', () => {
      this.audio.init();
      this.audio.unlock();
      if (this.audio.muted) {
        this.appToast('Sound is muted — click the speaker in the HUD.');
        return;
      }
      if (this.save.settings.music <= 0 && this.save.settings.sfx <= 0) {
        this.appToast('Both volume sliders are at 0%.');
        return;
      }
      this.audio.sfx('levelup');
      this.appToast('Audio test played');
    });
    $('#set-shake').addEventListener('change', (e) => {
      this.save.settings.shake = e.target.checked;
      persist(this.save);
    });
    $('#set-reduce').addEventListener('change', (e) => {
      this.save.settings.reduceMotion = e.target.checked;
      document.body.classList.toggle('reduce-motion', e.target.checked);
      persist(this.save);
    });
    $('#settings-done').addEventListener('click', () => this.closeModal());
    $('#settings-reset').addEventListener('click', () => {
      this.confirmModal('Erase all progress?', 'Gold, materials, forged gear, levels, map clears and records will be erased. This cannot be undone.', 'Erase everything', () => {
        wipeSave();
        const fresh = DEFAULT_SAVE();
        const settings = this.save.settings;
        Object.keys(this.save).forEach(k => { delete this.save[k]; });
        Object.assign(this.save, fresh, { settings });
        persistNow(this.save);
        this.pauseMenu.hidden = true;
        this.game.stopLoop();
        this.game.state = 'idle';
        this.game.paused = false;
        this.renderTitle();
        this.showScreen('title');
        this.audio.setMood('title');
        this.appToast('Progress erased');
      });
    });
    $$('#set-touch [data-touch-setting]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.save.settings.touch = btn.dataset.touchSetting;
        persist(this.save);
        $$('#set-touch [data-touch-setting]').forEach(b => b.classList.toggle('is-active', b === btn));
        this.applyTouchMode();
      });
    });
  }

  applySettings() {
    document.body.classList.toggle('reduce-motion', !!this.save.settings.reduceMotion);
    this.audio.setVolumes({ music: this.save.settings.music, sfx: this.save.settings.sfx });
    this.applyTouchMode();
  }

  // ----------------------------------------------------------
  // touch controls
  // ----------------------------------------------------------
  bindTouch() {
    const stick = $('#stick');
    const knob = $('#stick-knob');
    let active = false;
    let center = { x: 0, y: 0 };
    let pointerId = null;

    const updateStick = (clientX, clientY) => {
      const rect = stick.getBoundingClientRect();
      const max = rect.width * 0.34;
      let dx = clientX - center.x;
      let dy = clientY - center.y;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.game.input.setStick(Math.max(-1, Math.min(1, dx / max)), Math.max(-1, Math.min(1, dy / max)));
    };

    stick.addEventListener('pointerdown', (e) => {
      if (!this.touchEnabled) return;
      e.preventDefault();
      active = true;
      pointerId = e.pointerId;
      try { stick.setPointerCapture?.(e.pointerId); } catch (err) { /* synthetic / unsupported pointer */ }
      const rect = stick.getBoundingClientRect();
      center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      updateStick(e.clientX, e.clientY);
      this.audio.init();
    });
    stick.addEventListener('pointermove', (e) => {
      if (!active || e.pointerId !== pointerId) return;
      e.preventDefault();
      updateStick(e.clientX, e.clientY);
    });
    const endStick = (e) => {
      if (e && e.pointerId !== pointerId) return;
      active = false;
      pointerId = null;
      knob.style.transform = 'translate(-50%, -50%)';
      this.game.input.setStick(0, 0);
      this.game.input.release('left');
      this.game.input.release('right');
    };
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);
    stick.addEventListener('lostpointercapture', endStick);

    const activePointers = new Map();
    $$('#touch-controls [data-touch]').forEach(btn => {
      const action = btn.dataset.touch;
      const down = (e) => {
        if (!this.touchEnabled) return;
        e.preventDefault();
        this.audio.init();
        btn.classList.add('is-pressed');
        activePointers.set(e.pointerId, action);
        try { btn.setPointerCapture?.(e.pointerId); } catch (err) { /* unsupported pointer */ }
        this.game.input.press(action);
      };
      const up = (e) => {
        e?.preventDefault();
        btn.classList.remove('is-pressed');
        activePointers.delete(e?.pointerId);
        this.game.input.release(action);
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
      btn.addEventListener('pointerleave', (e) => { if (e.buttons === 0) up(e); });
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });

    // Release only the action belonging to the pointer that ended.
    const releasePointer = (e) => {
      const action = activePointers.get(e.pointerId);
      if (!action) return;
      activePointers.delete(e.pointerId);
      this.game.input.release(action);
      const btn = document.querySelector(`#touch-controls [data-touch="${action}"]`);
      btn?.classList.remove('is-pressed');
    };
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);
  }

  applyTouchMode() {
    const setting = this.save.settings.touch || 'auto';
    const coarse = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    this.touchEnabled = setting === 'on' || (setting === 'auto' && coarse) || this.touchOverride;
    this.touchControls.hidden = !this.touchEnabled;
    document.body.classList.toggle('touch-mode', this.touchEnabled);
    if (!this.touchEnabled) this.game?.input.setStick(0, 0);
  }

  // ----------------------------------------------------------
  // global bindings
  // ----------------------------------------------------------
  bindGlobal() {
    document.addEventListener('click', (e) => {
      const back = e.target.closest('[data-action="back"]');
      if (back) {
        this.audio.sfx('ui');
        if (this.current === 'heroes') {
          if (this.heroMode === 'new') this.showScreen('title');
          else this.openCamp();
        } else if (this.current === 'codex') {
          if (this.codexReturn === 'camp') this.openCamp();
          else this.showScreen('title');
        }
      }
    });

    // Menu / HUD feedback for every interactive control, not only the handful
    // with bespoke handlers. The existing explicit calls are de-duplicated by
    // the audio engine's short SFX throttle.
    document.addEventListener('click', (e) => {
      const item = e.target.closest('button, .btn, [data-tab], [data-codex], .hero-card, .map-card, .settings-option, .material-chip');
      if (item && !item.disabled) this.audio.sfx('ui');
    });
    document.addEventListener('pointerover', (e) => {
      const overlayOpen = !this.pauseMenu.hidden || !this.inventoryMenu.hidden || !this.modalLayer.hidden;
      if (this.current === 'game' && !overlayOpen) return;
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const item = e.target.closest('button, .btn, [data-tab], [data-codex], .hero-card, .map-card, .settings-option, .material-chip');
      if (!item || item.disabled) return;
      if (e.relatedTarget instanceof Node && item.contains(e.relatedTarget)) return;
      const now = performance.now();
      if (now - (this.lastHoverSound || 0) < 70) return;
      this.lastHoverSound = now;
      this.audio.sfx('uiHover');
    });
    document.addEventListener('keydown', (e) => {
      if (this.current === 'game') return;
      if (e.key === 'Escape') {
        if (!this.modalLayer.hidden) { this.closeModal(); return; }
        if (this.current === 'game' && !this.pauseMenu.hidden) { this.closePause(); return; }
        if (this.current === 'codex') {
          if (this.codexReturn === 'camp') this.openCamp(); else this.showScreen('title');
        } else if (this.current === 'heroes') {
          if (this.heroMode === 'new') this.showScreen('title'); else this.openCamp();
        }
      }
    });
    const unlockAudio = () => {
      if (!this.audio.ctx) this.audio.init();
      else this.audio.unlock();
      // Browsers can leave an AudioContext suspended until a later gesture.
      // Give it a beat, then surface the common "why is it silent?" cases.
      setTimeout(() => {
        if (this.audioHintShown) return;
        const a = this.audio;
        if (a.ctx && a.ctx.state === 'running') {
          this.audioHintShown = true;
          if (a.muted) this.appToast('Sound is muted — click the speaker to unmute.');
          else if (a.settings.music <= 0 && a.settings.sfx <= 0) {
            this.appToast('Audio volume is at 0% — open Settings to raise it.');
          }
        } else if (a.ctx && a.ctx.state === 'suspended') {
          this.appToast('Browser audio is paused — click or tap once more.');
        }
      }, 220);
    };
    document.addEventListener('pointerdown', unlockAudio, { passive: true });
    document.addEventListener('keydown', unlockAudio);
    document.addEventListener('touchend', unlockAudio, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.audio.unlock();
    });
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#stage')) e.preventDefault();
    });
    window.addEventListener('beforeunload', () => persistNow(this.save));  }
}

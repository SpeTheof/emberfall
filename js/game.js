// ============================================================
// EMBERFALL — game engine, physics, combat, bosses
// ============================================================

import {
  HEROES, GEAR, ENEMIES, BOSS, MATERIALS, MAPS, DIFFICULTIES,
  heroPower, xpToNext, REGEN,
} from './data.js';
import {
  buildLevel, drawBackground, drawTerrain, drawDecor, drawPortal,
  drawChest, drawCheckpoint, VIEW_W, VIEW_H, SCALE, clamp, aabb, topAt, lerp,
} from './world.js';
import { Input } from './input.js';
import { icon } from './icons.js';

const GRAVITY = 1010;
const MAX_FALL = 480;

function rand(min, max) { return min + Math.random() * (max - min); }
function irand(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function approach(v, target, delta) {
  if (v < target) return Math.min(v + delta, target);
  return Math.max(v - delta, target);
}

export class Game {
  constructor({ canvas, assets, audio, save, callbacks }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.assets = assets;
    this.audio = audio;
    this.save = save;
    this.callbacks = callbacks || {};
    this.input = new Input(canvas, {
      onPause: () => this.callbacks.onPauseRequest?.(),
      onInventory: () => this.callbacks.onInventoryRequest?.(),
      onMute: () => {
        if (this.callbacks.onMute) this.callbacks.onMute();
        else this.audio.toggleMute();
      },
    });
    this.state = 'idle';
    this.paused = false;
    this.raf = null;
    this.last = 0;
    this.time = 0;
    this.cam = { x: 0, y: 0 };
    this.shake = 0;
    this.hitstop = 0;
    this.hudTimer = 0;
    this.particles = [];
    this.texts = [];
    this.projectiles = [];
    this.pickups = [];
    this.meteors = [];
    this.shockwaves = [];
    this.enemies = [];
    this.chests = [];
    this.checkpoints = [];
    this.boss = null;
    this.bossActive = false;
    this.bossDefeated = false;
    this.portal = null;
    this.run = null;
    this.level = null;
    this.player = null;
    this.introLock = 0;
    this.loop = this.loop.bind(this);
  }

  // ============================================================
  // RUN LIFECYCLE
  // ============================================================
  startRun({ heroId, mapId, difficulty = 1, seed }) {
    this.stopLoop();
    this.config = { heroId, mapId, difficulty, seed };
    this.save.activeHero = heroId;
    this.level = buildLevel(mapId, difficulty, seed || 1);
    this.difficulty = DIFFICULTIES.find(d => d.id === difficulty) || DIFFICULTIES[0];
    this.power = heroPower(heroId, this.save.heroes[heroId]);
    this.hero = HEROES[heroId];

    const startTop = topAt(this.level, this.level.start.x) ?? 330;
    this.player = {
      x: this.level.start.x,
      y: startTop - 15,
      w: 10, h: 15,
      vx: 0, vy: 0,
      facing: 1,
      onGround: false,
      coyote: 0,
      jumpBuffer: 0,
      jumps: 2,
      jumpCut: false,
      dropTimer: 0,
      invuln: 0,
      hurtFlash: 0,
      regenDelay: 0,
      regenSpark: 0,
      hp: this.power.maxHp,
      maxHp: this.power.maxHp,
      defense: this.power.defense,
      damage: this.power.damage,
      crit: this.power.crit,
      speed: this.power.speed,
      attackCd: 0,
      attackTimer: 0,
      combo: 0,
      comboTimer: 0,
      skillCd: 0,
      spinTimer: 0,
      spinTick: 0,
      dashTimer: 0,
      dashCd: 0,
      potions: 2,
      animTime: 0,
      dead: false,
      respawnX: this.level.start.x,
      respawnY: startTop - 15,
      hitBoss: false,
    };

    this.enemies = [];
    for (const sp of this.level.spawns) this.spawnEnemy(sp);
    this.chests = this.level.chests.map(c => ({ ...c, opened: false }));
    this.checkpoints = this.level.checkpoints.map(c => ({ ...c, activated: false }));
    this.portal = this.level.portal ? { ...this.level.portal, active: true } : null;
    this.boss = null;
    this.bossActive = false;
    this.bossDefeated = false;
    this.particles = [];
    this.texts = [];
    this.projectiles = [];
    this.pickups = [];
    this.meteors = [];
    this.shockwaves = [];
    this.rainQueue = [];
    this.rainTimer = 0;
    this.run = {
      heroId, mapId, difficulty,
      kills: 0,
      gold: 0,
      xp: 0,
      materials: {},
      bossKilled: false,
      startedAt: performance.now(),
      time: 0,
    };
    for (const m of Object.keys(MATERIALS)) this.run.materials[m] = 0;

    this.introLock = 1.05;
    this.introTimer = 2.1;
    this.state = 'running';
    this.paused = false;
    this.time = 0;
    this.shake = 0;
    this.hitstop = 0;
    this.cam = {
      x: clamp(this.player.x - VIEW_W * 0.4, 0, Math.max(0, this.level.width - VIEW_W)),
      y: clamp(this.player.y - VIEW_H * 0.6, 0, this.level.height - VIEW_H),
    };
    this.input.reset();
    this.input.enabled = true;
    this.audio.init();
    this.audio.setMood('battle');
    this.callbacks.onRunStart?.({
      map: this.level.map,
      difficulty: this.difficulty,
      hero: this.hero,
    });
    this.callbacks.onIntro?.({
      map: this.level.map,
      difficulty: this.difficulty,
      hero: this.hero,
    });
    this.pushHud(true);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stopLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.last = 0;
  }

  loop(ts) {
    if (!this.last) this.last = ts;
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    dt = Math.max(0, Math.min(dt, 0.05));

    this.input.pollGamepad();
    let didUpdate = false;
    if (this.state === 'running' && !this.paused) {
      if (this.hitstop > 0) {
        this.hitstop -= dt;
      } else {
        this.update(dt);
        didUpdate = true;
      }
    }
    if (this.state === 'running' || this.state === 'dying' || this.state === 'won') {
      this.render();
    }
    if (didUpdate || this.paused || this.state !== 'running') this.input.endFrame();
    if (this.state === 'running' || this.state === 'dying') {
      this.raf = requestAnimationFrame(this.loop);
    } else {
      this.raf = null;
    }
  }

  pause() {
    if (this.state !== 'running' || this.paused) return;
    this.paused = true;
    this.audio.setMood('none');
    this.pushHud(true);
  }

  resume() {
    if (this.state !== 'running') return;
    this.paused = false;
    this.last = performance.now();
    this.audio.setMood(this.bossActive ? 'boss' : 'battle');
    this.input.reset();
    this.pushHud(true);
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  finishRun(victory, extra = {}) {
    if (this.state === 'ended' || this.state === 'won' || this.state === 'lost') return;
    const wasRunning = this.state === 'running' || this.state === 'dying';
    if (!wasRunning) return;
    this.state = victory ? 'won' : 'lost';
    this.collectAllPickups();
    const map = this.level.map;
    const diff = this.difficulty;
    const clearBonus = victory ? Math.round(map.clearBonus * diff.gold) : 0;
    const xp = Math.round(this.run.xp + (victory ? map.xpClear * diff.xp : 0));
    const gold = this.run.gold + clearBonus;
    const result = {
      mapId: map.id,
      difficulty: diff.id,
      heroId: this.run.heroId,
      victory,
      abandoned: !!extra.abandoned,
      loot: { gold, materials: { ...this.run.materials } },
      kills: this.run.kills,
      bossKilled: this.run.bossKilled,
      time: Math.round((performance.now() - this.run.startedAt) / 1000),
      xp,
      clearBonus,
    };
    this.audio.setMood(victory ? 'victory' : 'defeat');
    if (victory) this.audio.sfx('levelup');
    this.stopLoop();
    this.callbacks.onRunEnd?.(result);
  }

  abandonRun() {
    if (this.state !== 'running') return;
    this.finishRun(false, { abandoned: true });
  }

  debugJumpBoss() {
    if (!this.level || !this.level.arena || !this.player) return;
    this.player.x = this.level.bossTriggerX + 20;
    this.player.y = this.level.arena.floorY - this.player.h - 2;
    this.player.vx = 0;
    this.player.vy = 0;
    this.cam.x = clamp(this.player.x - VIEW_W * 0.35, 0, this.level.width - VIEW_W);
    this.cam.y = this.level.arena.floorY - VIEW_H * 0.7;
    this.startBoss();
  }

  // ============================================================
  // MAIN UPDATE
  // ============================================================
  update(dt) {
    this.time += dt;
    this.run.time += dt;
    if (this.introLock > 0) this.introLock -= dt;
    if (this.introTimer > 0) this.introTimer -= dt;
    this.shake = Math.max(0, this.shake - dt * 38);
    this.updatePlayer(dt);
    if (this.level && this.level.bossTriggerX != null && !this.bossActive && !this.bossDefeated &&
      this.player && this.player.x > this.level.bossTriggerX) {
      this.startBoss();
    }
    this.updateEnemies(dt);
    if (this.bossActive && this.boss) this.updateBoss(dt);
    this.updateProjectiles(dt);
    this.updateRain(dt);
    this.updateMeteors(dt);
    this.updateShockwaves(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateTexts(dt);
    this.updateCamera(dt);
    this.drawAmbient(dt);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.08;
      this.pushHud();
    }
  }

  // ============================================================
  // PLAYER
  // ============================================================
  updatePlayer(dt) {
    const p = this.player;
    if (!p || p.dead) {
      if (this.state === 'dying') {
        p.vy += GRAVITY * dt;
        p.y += p.vy * dt;
      }
      return;
    }
    p.animTime += dt;
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.attackTimer = Math.max(0, p.attackTimer - dt);
    p.comboTimer = Math.max(0, p.comboTimer - dt);
    p.skillCd = Math.max(0, p.skillCd - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);
    p.dashTimer = Math.max(0, p.dashTimer - dt);
    p.dropTimer = Math.max(0, p.dropTimer - dt);
    p.coyote = Math.max(0, p.coyote - dt);
    p.regenDelay = Math.max(0, p.regenDelay - dt);

    // Garrick regenerates even while fighting; other heroes need a lull.
    const warriorRegen = this.hero.id === 'warrior';
    if ((warriorRegen || p.regenDelay <= 0) && p.hp > 0 && p.hp < p.maxHp) {
      const rate = Math.max(REGEN.min, p.maxHp * REGEN.rate);
      p.hp = Math.min(p.maxHp, p.hp + rate * dt);
      p.regenSpark -= dt;
      if (p.regenSpark <= 0) {
        p.regenSpark = 0.7;
        this.particles.push({
          x: p.x + rand(1, p.w - 1), y: p.y + rand(2, p.h - 2),
          vx: rand(-4, 4), vy: rand(-22, -10),
          life: 0.8, maxLife: 0.8, color: '#9be08a',
          size: rand(0.8, 1.5), gravity: -12, kind: 'square',
        });
      }
    }
    if (p.spinTimer > 0) {
      p.spinTimer -= dt;
      p.spinTick -= dt;
      if (p.spinTick <= 0) {
        p.spinTick = 0.28;
        this.spinHit();
      }
    }

    const input = this.input;
    const locked = this.introLock > 0;
    const move = locked ? 0 : input.moveX;
    const dropHeld = input.isDown('down') || input.stickValue.y > 0.6;

    if (Math.abs(move) > 0.08) {
      p.facing = move > 0 ? 1 : -1;
      const accel = p.onGround ? 980 : 720;
      p.vx = approach(p.vx, move * p.speed, accel * dt);
    } else {
      p.vx = approach(p.vx, 0, (p.onGround ? 1250 : 500) * dt);
    }

    if (!locked && input.wasPressed('jump')) p.jumpBuffer = 0.13;
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

    if (!locked && input.wasPressed('dash') && p.dashCd <= 0 && p.dashTimer <= 0) {
      p.dashTimer = 0.16;
      p.dashCd = 0.95;
      p.vx = p.facing * 335;
      p.vy = Math.min(p.vy, 0);
      p.invuln = Math.max(p.invuln, 0.22);
      this.audio.sfx('dash');
      this.spawnAfterimage();
      this.burst(p.x + p.w / 2, p.y + p.h / 2, 8, ['#d9c9a4', '#8f7b5b'], 70, 0, 1.5);
    }

    if (p.dashTimer > 0) {
      p.vx = p.facing * 335;
      p.vy = 0;
      if (Math.random() < 0.6) this.spawnAfterimage();
    } else {
      p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
    }

    // jumping (with coyote time, double jump and drop-through)
    if (p.jumpBuffer > 0 && p.jumps > 0 && !locked) {
      const wasGround = p.onGround || p.coyote > 0;
      if (dropHeld && wasGround && this.isOnOneWay(p)) {
        p.dropTimer = 0.22;
        p.jumpBuffer = 0;
      } else {        p.vy = -315;
        p.jumps--;
        p.onGround = false;
        p.coyote = 0;
        p.jumpBuffer = 0;
        p.jumpCut = false;
        this.audio.sfx(wasGround ? 'jump' : 'doubleJump');
        if (wasGround) {
          this.burst(p.x + p.w / 2, p.y + p.h, 7, ['#c9b98e', '#8f7b5b'], 42, 80, 1.3);
        } else {
          this.burst(p.x + p.w / 2, p.y + p.h, 10, ['#f2d18c', '#e2672c'], 58, 20, 1.5);
          this.ring(p.x + p.w / 2, p.y + p.h / 2, 3, 10, '#f2d18c', 0.25);
        }
      }
    }
    if (!input.isDown('jump') && p.vy < -100 && !p.jumpCut) {
      p.vy *= 0.52;
      p.jumpCut = true;
    }

    if (!locked && input.wasPressed('attack')) this.doAttack();
    if (!locked && input.wasPressed('skill')) this.doSkill();
    if (!locked && input.wasPressed('potion')) this.usePotion();
    if (!locked && input.wasPressed('interact')) this.interact();

    // move & collide
    const wasGround = p.onGround;
    this.moveBody(p, dt, { dropThrough: p.dropTimer > 0 });
    this.resolvePenetration(p);
    if (p.onGround && !wasGround) {
      p.jumps = 2;
      p.jumpCut = false;
      if (p.vy === 0) {
        this.audio.sfx('land');
        this.burst(p.x + p.w / 2, p.y + p.h, 6, ['#cbb78e', '#7c684c'], 45, 100, 1.2);
      }
    }
    if (p.onGround) {
      p.coyote = 0.11;
      p.jumps = 2;
    }

    // world bounds
    p.x = clamp(p.x, 0, this.level.width - p.w);
    if (this.bossActive && this.level.arena) {
      p.x = clamp(p.x, this.level.arena.x0 + 6, this.level.arena.x1 - p.w - 6);
    }

    // pit fall
    if (p.y > this.level.killY) {
      this.pitFall();
      return;
    }

    // torch / chest interaction prompt update
    if (this.hudTimer < 0.04) this.pushHud(true);
  }

  moveBody(body, dt, opts = {}) {
    const solids = this.level.solids;
    const oneWays = this.level.oneWays;
    const prevBottom = body.y + body.h;
    const prevX = body.x;

    body.x += body.vx * dt;
    for (const s of solids) {
      if (!aabb(body, s)) continue;
      if (body.vx > 0) body.x = s.x - body.w;
      else if (body.vx < 0) body.x = s.x + s.w;
      body.vx = 0;
    }
    for (const side of this.level.oneWaySides || []) {
      if (!aabb(body, side)) continue;
      if (body.vx > 0) body.x = side.x - body.w;
      else if (body.vx < 0) body.x = side.x + side.w;
      body.vx = 0;
    }
    if (body.x < 0) { body.x = 0; body.vx = 0; }
    if (body.x + body.w > this.level.width) {
      body.x = this.level.width - body.w;
      body.vx = 0;
    }

    body.y += body.vy * dt;
    body.onGround = false;
    for (const s of solids) {
      if (!aabb(body, s)) continue;
      if (body.vy > 0) {
        body.y = s.y - body.h;
        body.vy = 0;
        body.onGround = true;
      } else if (body.vy < 0) {
        body.y = s.y + s.h;
        body.vy = 0;
      }
    }

    if (!opts.dropThrough && body.vy >= 0) {
      for (const p of oneWays) {
        if (body.x + body.w <= p.x || body.x >= p.x + p.w) continue;
        const newBottom = body.y + body.h;
        if (prevBottom <= p.y + 2 && newBottom >= p.y) {
          body.y = p.y - body.h;
          body.vy = 0;
          body.onGround = true;
        }
      }
    }

    // if a one-way starts inside the body (spawned) push up
    if (body.onGround === false && body.vy >= 0) {
      for (const p of oneWays) {
        if (body.x + body.w <= p.x || body.x >= p.x + p.w) continue;
        if (body.y + body.h > p.y && body.y + body.h < p.y + 8 && body.y < p.y) {
          body.y = p.y - body.h;
          body.vy = 0;
          body.onGround = true;
        }
      }
    }

    if (opts.stopAtWall && Math.abs(body.x - prevX) < 0.01 && Math.abs(body.vx) < 0.01) {
      body.blocked = true;
    }
  }

  isOnOneWay(body) {
    for (const p of this.level.oneWays) {
      if (body.x + body.w <= p.x || body.x >= p.x + p.w) continue;
      if (Math.abs(body.y + body.h - p.y) < 3) return true;
    }
    return false;
  }

  // Rescue the player if a spawn, dash or terrain seam leaves them inside a
  // solid. Normal movement is already resolved by moveBody; this is a safety
  // net so nobody can get permanently wedged in a wall.
  resolvePenetration(body) {
    for (const s of this.level.solids) {
      if (!aabb(body, s)) continue;
      const ox = Math.min(body.x + body.w, s.x + s.w) - Math.max(body.x, s.x);
      const oy = Math.min(body.y + body.h, s.y + s.h) - Math.max(body.y, s.y);
      if (ox <= 0.2 || oy <= 0.2) continue;
      if (ox < oy) {
        if (body.x + body.w / 2 < s.x + s.w / 2) body.x = s.x - body.w;
        else body.x = s.x + s.w;
        body.vx = 0;
      } else {
        if (body.y + body.h / 2 < s.y + s.h / 2) {
          body.y = s.y - body.h;
          body.vy = Math.min(0, body.vy);
          body.onGround = true;
        } else {
          body.y = s.y + s.h;
          body.vy = 0;
        }
      }
    }
  }

  groundAhead(body, dir) {
    const px = dir > 0 ? body.x + body.w + 3 : body.x - 3;
    const py = body.y + body.h + 4;
    for (const s of this.level.solids) {
      if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + 12) return true;
    }
    for (const p of this.level.oneWays) {
      if (px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + 10) return true;
    }
    return false;
  }

  // ============================================================
  // PLAYER ACTIONS
  // ============================================================
  doAttack() {
    const p = this.player;
    if (p.attackCd > 0 || p.dashTimer > 0) return;
    const cfg = this.hero.attack;
    p.attackCd = this.power.attackCooldown;
    p.attackTimer = 0.22;
    p.comboTimer = 0.72;

    if (cfg.type === 'melee') {
      const comboIndex = p.combo % 3;
      const mult = cfg.combo[comboIndex];
      p.combo = (p.combo + 1) % 3;
      const reach = cfg.reach;
      const hit = {
        x: p.facing > 0 ? p.x + p.w - 3 : p.x - reach + 3,
        y: p.y - 8,
        w: reach,
        h: 30,
      };
      let hitAny = false;
      for (const e of this.enemies) {
        if (e.dead || e.spawnFade > 0) continue;
        if (aabb(hit, e)) {
          const crit = Math.random() < p.crit;
          this.damageEnemy(e, p.damage * mult * (crit ? 1.6 : 1), crit, p.facing * 115);
          hitAny = true;
        }
      }
      if (this.boss && !this.boss.dead && aabb(hit, this.bossHitbox())) {
        const crit = Math.random() < p.crit;
        this.damageBoss(p.damage * mult * (crit ? 1.7 : 1), crit);
        hitAny = true;
      }
      this.audio.sfx('sword');
      this.slashEffect(comboIndex, mult);
      if (hitAny) this.hitstop = Math.max(this.hitstop, 0.035);
    } else if (cfg.type === 'projectile') {
      this.spawnPlayerProjectile('fireball');
      this.audio.sfx('fireball');
      this.castFlash('#ffb066');
    } else if (cfg.type === 'arrow') {
      this.spawnPlayerProjectile('arrow');
      this.audio.sfx('arrow');
      this.castFlash('#d7e8b4');
    }
  }

  doSkill() {
    const p = this.player;
    if (p.skillCd > 0) return;
    const skill = this.hero.skill;
    p.skillCd = skill.cooldown;
    this.audio.sfx('skill');
    if (skill.id === 'tempest') {
      p.spinTimer = 0.95;
      p.spinTick = 0.05;
      this.burst(p.x + p.w / 2, p.y + p.h / 2, 26, ['#f2d18c', '#e08a52', '#ffffff'], 150, 0, 2);
      this.ring(p.x + p.w / 2, p.y + p.h / 2, 8, 46, '#f2d18c', 0.6);
      this.shake = Math.max(this.shake, 4);
    } else if (skill.id === 'nova') {
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      this.burst(cx, cy, 48, ['#ffd28a', '#e2672c', '#a83232', '#fff4cf'], 220, 30, 2.4);
      this.ring(cx, cy, 6, 82, '#ffb066', 0.85);
      this.ring(cx, cy, 2, 62, '#ffe3aa', 0.6);
      this.shake = Math.max(this.shake, 9);
      this.explode(cx, cy, 82, p.damage * 2.2, 'player');
      this.hitstop = 0.07;
    } else if (skill.id === 'rain') {
      this.rainQueue = [];
      for (let i = 0; i < 10; i++) {
        this.rainQueue.push({
          x: p.x + p.w / 2 + rand(-130, 130),
          delay: 0.18 + i * 0.085,
        });
      }
      this.audio.sfx('arrow');
      this.burst(p.x + p.w / 2, p.y, 20, ['#d7e8b4', '#f2d18c'], 100, -20, 1.7);
    }
  }

  spinHit() {
    const p = this.player;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const hit = { x: cx - 44, y: cy - 36, w: 88, h: 72 };
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (aabb(hit, e)) {
        const dir = Math.sign(e.x + e.w / 2 - cx) || 1;
        this.damageEnemy(e, p.damage * 0.82, false, dir * 80);
      }
    }
    if (this.boss && !this.boss.dead && aabb(hit, this.bossHitbox())) {
      this.damageBoss(p.damage * 0.7, false);
    }
    this.slashRing(cx, cy);
    this.audio.sfx('sword');
  }

  usePotion() {
    const p = this.player;
    if (p.potions <= 0 || p.hp >= p.maxHp) return;
    p.potions--;
    const heal = Math.round(p.maxHp * 0.45);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    this.audio.sfx('potion');
    this.burst(p.x + p.w / 2, p.y + p.h / 2, 16, ['#d24a45', '#ff8f7a', '#ffd6c2'], 60, -30, 1.8);
    this.floatText(p.x + p.w / 2, p.y - 2, `+${heal}`, '#9be08a');
    this.pushHud(true);
  }

  // ---- combat feedback ----
  slashEffect(comboIndex, mult) {
    const p = this.player;
    const cx = p.x + p.w / 2 + p.facing * 10;
    const cy = p.y + p.h / 2 - 1;
    const color = comboIndex === 2 ? '#ffd76e' : '#fff4cf';
    this.particles.push({
      kind: 'slash', x: cx, y: cy, vx: p.facing * 34, vy: 0,
      life: 0.19, maxLife: 0.19, color, size: 2,
      facing: p.facing, combo: comboIndex, radius: 19 + comboIndex * 5 + mult * 4,
    });
    this.ring(cx + p.facing * 5, cy, 4, 20 + comboIndex * 6, color, 0.16);
  }

  castFlash(color) {
    const p = this.player;
    const cx = p.x + p.w / 2 + p.facing * 10;
    const cy = p.y + 5;
    this.ring(cx, cy, 2, 13, color, 0.22);
    this.burst(cx, cy, 4, [color, '#fff4cf'], 42, 0, 1.2);
  }

  slashRing(cx, cy) {
    this.ring(cx, cy, 12, 34, '#f2d18c', 0.22);
  }

  interact() {
    const target = this.nearestInteractive();
    if (!target) return;
    if (target.type === 'chest') {
      this.openChest(target.ref);
    } else if (target.type === 'checkpoint') {
      this.activateCheckpoint(target.ref);
    } else if (target.type === 'portal') {
      this.audio.sfx('portal');
      this.finishRun(true);
    }
  }

  nearestInteractive() {
    const p = this.player;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    let best = null;
    let bestDist = 1e9;
    for (const c of this.chests) {
      if (c.opened) continue;
      const dx = Math.abs(c.x + 8 - cx);
      const dy = Math.abs(c.y + 7 - cy);
      if (dx < 34 && dy < 34 && dx + dy < bestDist) {
        bestDist = dx + dy;
        best = { type: 'chest', ref: c, label: 'Open chest' };
      }
    }
    for (const c of this.checkpoints) {
      if (c.activated) continue;
      const dx = Math.abs(c.x + 8 - cx);
      const dy = Math.abs(c.y + 10 - cy);
      if (dx < 34 && dy < 40 && dx + dy < bestDist) {
        bestDist = dx + dy;
        best = { type: 'checkpoint', ref: c, label: 'Kindle checkpoint' };
      }
    }
    if (this.portal && this.portal.active) {
      const dx = Math.abs(this.portal.x + 13 - cx);
      const dy = Math.abs(this.portal.y + 21 - cy);
      if (dx < 38 && dy < 46 && dx + dy < bestDist) {
        best = { type: 'portal', ref: this.portal, label: this.level.map.boss ? 'Take the shard gate' : 'Enter the shard gate' };
      }
    }
    return best;
  }

  openChest(chest) {
    if (chest.opened) return;
    chest.opened = true;
    const gold = chest.gold || 20;
    this.run.gold += gold;
    const gained = [];
    for (const [mat, count] of Object.entries(chest.mats || {})) {
      this.run.materials[mat] = (this.run.materials[mat] || 0) + count;
      gained.push(`+${count} ${MATERIALS[mat]?.short || mat}`);
    }
    this.audio.sfx('chest');
    this.burst(chest.x + 8, chest.y + 4, 26, ['#f7df9f', '#e8b95c', '#fff4cf'], 120, 190, 1.6);
    this.floatText(chest.x + 8, chest.y - 6, `+${gold} gold`, '#f7df9f');
    if (gained.length) this.floatText(chest.x + 8, chest.y - 16, gained.join(' · '), '#d9c9a4');
    this.callbacks.onToast?.(`Chest opened — +${gold} gold${gained.length ? ' · ' + gained.join(' · ') : ''}`);
    this.shake = Math.max(this.shake, 2);
    this.pushHud(true);
  }

  activateCheckpoint(cp) {
    cp.activated = true;
    this.player.respawnX = cp.x + 8 - this.player.w / 2;
    this.player.respawnY = cp.y + 20 - this.player.h;
    const heal = Math.round(this.player.maxHp * 0.35);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    this.audio.sfx('checkpoint');
    this.burst(cp.x + 8, cp.y, 30, ['#ffd28a', '#ff9c4a', '#f7df9f'], 90, -40, 1.8);
    this.ring(cp.x + 8, cp.y + 6, 5, 34, '#f2d18c', 0.7);
    this.floatText(cp.x + 8, cp.y - 10, 'Checkpoint kindled', '#f2d18c');
    this.callbacks.onToast?.('Checkpoint kindled — health restored');
    this.pushHud(true);
  }

  pitFall() {
    const p = this.player;
    const dmg = Math.max(8, Math.round(p.maxHp * 0.18));
    p.hp -= dmg;
    p.x = p.respawnX;
    p.y = p.respawnY - 2;
    p.vx = 0;
    p.vy = 0;
    p.invuln = 1.2;
    p.regenDelay = REGEN.delay;
    p.hurtFlash = 0.3;
    this.cam.x = clamp(p.x - VIEW_W / 2, 0, this.level.width - VIEW_W);
    this.shake = Math.max(this.shake, 7);
    this.audio.sfx('hurt');
    this.floatText(p.x + p.w / 2, p.y - 6, `-${dmg}`, '#ff8f7a');
    if (p.hp <= 0) this.die();
  }

  hurtPlayer(amount, sourceX = null, knock = 0) {
    const p = this.player;
    if (!p || p.dead || p.invuln > 0) return;
    const mitigated = Math.max(1, Math.round(amount * (100 / (100 + p.defense))));
    p.hp -= mitigated;
    p.invuln = 0.95;
    p.regenDelay = REGEN.delay;
    p.hurtFlash = 0.28;
    p.vy = -180;
    const dir = sourceX == null ? -p.facing : Math.sign(p.x + p.w / 2 - sourceX) || 1;
    p.vx = dir * (110 + knock);
    this.shake = Math.max(this.shake, 7);
    this.hitstop = Math.max(this.hitstop, 0.055);
    this.audio.sfx('hurt');
    this.floatText(p.x + p.w / 2, p.y - 4, `-${mitigated}`, '#ff8f7a');
    this.burst(p.x + p.w / 2, p.y + p.h / 2, 12, ['#b43b3b', '#ff8f7a', '#6b1f24'], 100, 80, 1.7);
    if (p.hp <= 0) this.die();
    this.pushHud(true);
  }

  die() {
    if (this.state !== 'running') return;
    const p = this.player;
    p.dead = true;
    p.hp = 0;
    this.state = 'dying';
    this.audio.setMood('none');
    this.audio.sfx('death');
    this.burst(p.x + p.w / 2, p.y + p.h / 2, 34, ['#b43b3b', '#6b1f24', '#f2d18c'], 150, 180, 2.2);
    this.shake = 10;
    this.callbacks.onToast?.('You have fallen');
    this.pushHud(true);
    setTimeout(() => {
      if (this.state === 'dying') this.finishRun(false);
    }, 1600);
  }

  // ============================================================
  // PROJECTILES
  // ============================================================
  spawnPlayerProjectile(kind) {
    const p = this.player;
    const dir = p.facing;
    const cx = p.x + p.w / 2 + dir * 10;
    const cy = p.y + 5;
    const target = this.findAimTarget(cx, cy);
    let angle = dir > 0 ? 0 : Math.PI;
    if (target) {
      angle = Math.atan2(target.y - cy, target.x - cx);
      p.facing = Math.cos(angle) >= 0 ? 1 : -1;
    }
    const speed = kind === 'fireball' ? 285 : 430;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    if (kind === 'fireball') {
      this.projectiles.push({
        kind: 'playerFire', owner: 'player',
        x: cx, y: cy, w: 8, h: 8,
        vx, vy,
        damage: p.damage,
        life: 1.8,
        explodes: true,
        radius: 26,
        angle,
      });
    } else {
      this.projectiles.push({
        kind: 'playerArrow', owner: 'player',
        x: cx, y: cy, w: 10, h: 3,
        vx, vy,
        damage: p.damage,
        life: 1.3,
        explodes: false,
        angle,
      });
    }
  }

  findAimTarget(cx, cy) {
    const p = this.player;
    let best = null;
    let bestScore = 1e9;
    const consider = (x, y) => {
      const dx = x - cx;
      if (dx * p.facing < -26) return;
      const d = Math.hypot(dx, y - cy);
      if (d > 300) return;
      const score = d + Math.abs(dx) * 0.25;
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    };
    for (const e of this.enemies) {
      if (e.dead) continue;
      consider(e.x + e.w / 2, e.y + e.h / 2);
    }
    if (this.boss && !this.boss.dead) {
      consider(this.boss.x, this.boss.y + 8);
    }
    return best;
  }

  spawnEnemyProjectile(kind, x, y, vx, vy, damage, opts = {}) {
    this.projectiles.push({
      kind, owner: 'enemy',
      x, y,
      w: opts.w || 8, h: opts.h || 8,
      vx, vy,
      damage,
      life: opts.life || 3,
      gravity: opts.gravity || 0,
      explodes: !!opts.explodes,
      radius: opts.radius || 24,
      angle: Math.atan2(vy, vx),
    });
  }

  updateProjectiles(dt) {
    const p = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.life <= 0) { this.projectiles.splice(i, 1); continue; }
      if (pr.gravity) pr.vy += pr.gravity * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.angle = Math.atan2(pr.vy, pr.vx);
      const body = { x: pr.x - pr.w / 2, y: pr.y - pr.h / 2, w: pr.w, h: pr.h };

      if (pr.kind === 'playerFire' || pr.kind === 'playerArrow' || pr.kind === 'rainArrow') {
        // hit enemies
        let hitSomething = false;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (aabb(body, e)) {
            const crit = Math.random() < p.crit;
            this.damageEnemy(e, pr.damage * (crit ? 1.55 : 1), crit, pr.vx > 0 ? 90 : -90);
            hitSomething = true;
            if (pr.kind === 'playerFire') this.explode(pr.x, pr.y, pr.radius, pr.damage * 0.6, 'player');
            break;
          }
        }
        if (!hitSomething && this.boss && !this.boss.dead && aabb(body, this.bossHitbox())) {
          const crit = Math.random() < p.crit;
          this.damageBoss(pr.damage * (crit ? 1.55 : 1), crit);
          if (pr.kind === 'playerFire') this.explode(pr.x, pr.y, pr.radius, pr.damage * 0.5, 'player');
          hitSomething = true;
        }
        if (hitSomething) { this.projectiles.splice(i, 1); continue; }
        // hit world
        if (this.projectileHitsSolid(body)) {
          if (pr.kind === 'playerFire') this.explode(pr.x, pr.y, pr.radius, pr.damage * 0.6, 'player');
          else this.burst(pr.x, pr.y, 5, ['#d9c9a4', '#8a7d67'], 40, 80, 1);
          this.projectiles.splice(i, 1);
          continue;
        }
      } else {
        if (aabb(body, p) && p.invuln <= 0 && !p.dead) {
          this.hurtPlayer(pr.damage, pr.x, 30);
          if (pr.explodes) this.explode(pr.x, pr.y, pr.radius, 0, 'enemy');
          this.projectiles.splice(i, 1);
          continue;
        }
        if (this.projectileHitsSolid(body)) {
          if (pr.explodes) this.explode(pr.x, pr.y, pr.radius, pr.damage * 0.7, 'enemy');
          this.projectiles.splice(i, 1);
          continue;
        }
      }
    }
  }

  projectileHitsSolid(body) {
    for (const s of this.level.solids) if (aabb(body, s)) return true;
    return false;
  }

  explode(x, y, radius, damage, source) {
    this.burst(x, y, 22, source === 'player' ? ['#ffd28a', '#e2672c', '#fff4cf'] : ['#ff9c4a', '#b43b3b', '#ffd28a'], 170, 40, 2);
    this.ring(x, y, 5, radius, source === 'player' ? '#ffb066' : '#ff6a4a', 0.45);
    this.shake = Math.max(this.shake, 3);
    if (damage > 0) {
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = (e.x + e.w / 2) - x;
        const dy = (e.y + e.h / 2) - y;
        if (Math.hypot(dx, dy) <= radius + 10) {
          this.damageEnemy(e, damage, false, Math.sign(dx || 1) * 70);
        }
      }
      if (source === 'player' && this.boss && !this.boss.dead) {
        const dx = this.boss.x - x;
        const dy = this.boss.y - y;
        if (Math.hypot(dx, dy) <= radius + 26) this.damageBoss(damage, false);
      }
      if (source === 'enemy') {
        const dx = (this.player.x + this.player.w / 2) - x;
        const dy = (this.player.y + this.player.h / 2) - y;
        if (Math.hypot(dx, dy) <= radius + 8) this.hurtPlayer(damage, x, 30);
      }
    }
  }

  updateRain(dt) {
    if (!this.rainQueue.length) return;
    for (let i = this.rainQueue.length - 1; i >= 0; i--) {
      const r = this.rainQueue[i];
      r.delay -= dt;
      if (r.delay <= 0) {
        this.projectiles.push({
          kind: 'rainArrow', owner: 'player',
          x: r.x, y: this.cam.y - 40, w: 8, h: 3,
          vx: 0, vy: 380,
          damage: this.player.damage * 0.78,
          life: 3,
          explodes: false,
          angle: Math.PI / 2,
        });
        this.rainQueue.splice(i, 1);
      }
    }
  }

  // ============================================================
  // ENEMIES
  // ============================================================
  spawnEnemy(spawn) {
    const cfg = ENEMIES[spawn.type];
    if (!cfg) return;
    const mapLevel = this.level.map.level;
    const diff = this.difficulty;
    const hp = Math.round(cfg.hp * diff.hp * (1 + 0.16 * (mapLevel - 1)));
    const damage = Math.round(cfg.damage * diff.dmg * (1 + 0.1 * (mapLevel - 1)));
    const e = {
      type: spawn.type,
      cfg,
      x: spawn.x,
      y: spawn.y,
      homeX: spawn.x,
      homeY: spawn.y,
      topY: spawn.topY,
      w: cfg.width,
      h: cfg.height,
      vx: 0, vy: 0,
      facing: -1,
      onGround: false,
      hp, maxHp: hp,
      damage,
      state: 'patrol',
      timer: rand(0.3, 1.4),
      attackCd: rand(0.3, 1.2),
      contactCd: 0,
      flash: 0,
      telegraph: 0,
      anim: rand(0, 10),
      dead: false,
      deathTimer: 0,
      spawnFade: 0,
      blocked: false,
      miniBoss: !!cfg.miniBoss,
      scale: cfg.miniBoss ? 2 : 1,
    };
    this.enemies.push(e);
  }

  updateEnemies(dt) {
    const p = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.anim += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.telegraph = Math.max(0, e.telegraph - dt);
      e.attackCd = Math.max(0, e.attackCd - dt);
      e.contactCd = Math.max(0, e.contactCd - dt);
      e.spawnFade = Math.max(0, e.spawnFade - dt);
      if (e.dead) {
        e.deathTimer -= dt;
        e.y += 12 * dt;
        if (e.deathTimer <= 0) this.enemies.splice(i, 1);
        continue;
      }
      if (!p || p.dead) continue;

      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      const px = p.x + p.w / 2;
      const py = p.y + p.h / 2;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.hypot(dx, dy);

      e.contactCd = Math.max(0, e.contactCd - dt);

      if (e.cfg.flying) {
        this.updateFlyingEnemy(e, dt, dx, dy, dist);
      } else if (e.cfg.ai === 'skeleton') {
        this.updateSkeleton(e, dt, dx, dy, dist);
      } else if (e.cfg.ai === 'slime') {
        this.updateSlime(e, dt, dx, dy, dist);
      } else if (e.cfg.ai === 'ogre') {
        this.updateGroundEnemy(e, dt, dx, dy, dist, { range: 62, windup: 0.7, cooldown: 1.8, damageMult: 1.2, ogre: true });
      } else {
        this.updateGroundEnemy(e, dt, dx, dy, dist, {
          range: e.cfg.ai === 'orc' ? 40 : 30,
          windup: e.cfg.ai === 'orc' ? 0.52 : 0.34,
          cooldown: e.cfg.ai === 'orc' ? 1.6 : 1.05,
          damageMult: e.cfg.ai === 'orc' ? 1.25 : 1,
        });
      }

      // contact damage
      if (e.cfg.contact && aabb(e, p) && e.contactCd <= 0 && p.invuln <= 0) {
        this.hurtPlayer(e.damage * 0.8, cx, 20);
        e.contactCd = 0.9;
        e.vx = -Math.sign(dx || 1) * 60;
      }

      // fell out of world
      if (e.y > this.level.killY) {
        this.enemies.splice(i, 1);
      }
    }
  }

  updateGroundEnemy(e, dt, dx, dy, dist, opts) {
    const p = this.player;
    const aggro = e.miniBoss ? 260 : 190;
    e.timer -= dt;

    if (e.state === 'windup') {
      e.telegraph = Math.max(0, e.timer);
      e.vx = approach(e.vx, 0, 900 * dt);
      if (e.timer <= 0) {
        e.state = 'recover';
        e.timer = 0.34;
        e.attackCd = opts.cooldown;
        const px = p.x + p.w / 2;
        const ex = e.x + e.w / 2;
        if (Math.abs(px - ex) < opts.range + 16 && Math.abs((p.y + p.h) - (e.y + e.h)) < 34) {
          this.hurtPlayer(e.damage * opts.damageMult, ex, 45);
          this.burst(px, p.y + p.h / 2, 10, ['#e2672c', '#f2d18c'], 70, 40, 1.4);
        }
        if (opts.ogre) {
          this.shockwaves.push({ x: ex, y: e.y + e.h, r: 8, maxR: 68, life: 0.45, maxLife: 0.45, hit: false, damage: e.damage * 0.8 });
          this.shake = Math.max(this.shake, 8);
          this.audio.sfx('explode');
        }
      }
      this.moveBody(e, dt);
      return;
    }
    if (e.state === 'recover') {
      e.vx = approach(e.vx, 0, 1000 * dt);
      e.timer -= 0;
      if (e.timer <= 0) e.state = 'chase';
      this.moveBody(e, dt);
      return;
    }
    if (e.state === 'stagger') {
      e.vx = approach(e.vx, 0, 700 * dt);
      if (e.timer <= 0) e.state = 'chase';
      e.timer -= dt;
      this.moveBody(e, dt);
      return;
    }

    if (dist < aggro) {
      e.state = 'chase';
      e.facing = dx >= 0 ? 1 : -1;
      if (Math.abs(dx) < opts.range && Math.abs(dy) < 32) {
        if (e.attackCd <= 0) {
          e.state = 'windup';
          e.timer = opts.windup;
          e.telegraph = opts.windup;
          e.vx = 0;
        }
      } else {
        const speed = e.cfg.speed * (e.miniBoss ? 0.9 : 1);
        const dir = e.facing;
        if (this.groundAhead(e, dir) || !e.onGround) {
          e.vx = approach(e.vx, dir * speed, 480 * dt);
        } else {
          e.vx = approach(e.vx, 0, 700 * dt);
          e.facing *= -1;
        }
      }
    } else {
      e.state = 'patrol';
      e.timer -= dt;
      if (e.timer <= 0) {
        e.timer = rand(1.2, 2.6);
        e.facing = Math.random() < 0.5 ? -1 : 1;
      }
      const homeDist = e.x - e.homeX;
      if (Math.abs(homeDist) > 95) e.facing = Math.sign(e.homeX - e.x);
      if (this.groundAhead(e, e.facing)) {
        e.vx = approach(e.vx, e.facing * e.cfg.speed * 0.35, 300 * dt);
      } else {
        e.vx = 0;
        e.facing *= -1;
      }
    }

    // gravity + collision
    e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
    const prevX = e.x;
    this.moveBody(e, dt);
    if (Math.abs(e.x - prevX) < 0.1 && Math.abs(e.vx) < 1 && e.onGround) e.blocked = true;
    else e.blocked = false;
    if (e.blocked && e.state === 'chase') e.facing *= -1;
    if (e.onGround) e.vy = 0;
  }

  updateSkeleton(e, dt, dx, dy, dist) {
    const p = this.player;
    e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
    e.facing = dx >= 0 ? 1 : -1;
    if (e.state === 'windup') {
      e.telegraph = Math.max(0, e.timer);
      e.timer -= dt;
      e.vx = 0;
      if (e.timer <= 0) {
        e.state = 'chase';
        const sx = e.x + e.w / 2 + e.facing * 6;
        const sy = e.y + 4;
        const tx = p.x + p.w / 2;
        const ty = p.y + p.h / 2;
        const ang = Math.atan2(ty - sy, tx - sx);
        this.spawnEnemyProjectile('bone', sx, sy, Math.cos(ang) * 190, Math.sin(ang) * 190 - 30, e.damage, {
          w: 7, h: 5, gravity: 220, life: 3,
        });
        this.audio.sfx('arrow');
        e.attackCd = 2.0;
      }
      this.moveBody(e, dt);
      return;
    }
    if (dist < 230 && e.attackCd <= 0) {
      e.state = 'windup';
      e.timer = 0.42;
      e.telegraph = 0.42;
      e.vx = 0;
    } else {
      e.state = 'chase';
      if (dist < 55) e.vx = approach(e.vx, -e.facing * e.cfg.speed, 400 * dt);
      else if (dist > 140) e.vx = approach(e.vx, e.facing * e.cfg.speed * 0.6, 300 * dt);
      else e.vx = approach(e.vx, 0, 500 * dt);
    }
    this.moveBody(e, dt);
    if (e.onGround) e.vy = 0;
  }

  updateSlime(e, dt, dx, dy, dist) {
    const p = this.player;
    e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
    e.facing = dx >= 0 ? 1 : -1;
    e.timer -= dt;
    if (e.onGround && e.timer <= 0 && dist < 220) {
      e.timer = rand(0.8, 1.4);
      e.vy = -235;
      e.vx = e.facing * 95;
      this.audio.sfx('jump');
    }
    if (e.state === 'windup') {
      e.timer -= dt;
      if (e.timer <= 0) { e.state = 'chase'; e.attackCd = 1.7; }
    }
    this.moveBody(e, dt);
    if (e.onGround) {
      e.vx = approach(e.vx, 0, 600 * dt);
    }
  }

  updateFlyingEnemy(e, dt, dx, dy, dist) {
    const p = this.player;
    e.facing = dx >= 0 ? 1 : -1;
    e.timer -= dt;
    const speed = e.cfg.speed;
    if (dist < 240) {
      e.vx = approach(e.vx, e.facing * speed, 300 * dt);
      e.vy = approach(e.vy, clamp(dy * 2.5, -100, 100) + Math.sin(e.anim * 3) * 22, 300 * dt);
      if (dist < 24 && e.contactCd <= 0) {
        e.contactCd = 1.0;
        e.vx = -e.facing * 90;
        e.vy = -50;
      }
    } else {
      const hx = e.homeX - e.x;
      const hy = e.homeY - e.y;
      e.vx = approach(e.vx, Math.sign(hx) * speed * 0.4, 160 * dt);
      e.vy = approach(e.vy, Math.sign(hy) * 40 + Math.sin(e.anim * 2) * 16, 160 * dt);
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.y = clamp(e.y, 40, this.level.height - 60);
    e.x = clamp(e.x, 4, this.level.width - e.w - 4);
    if (e.y > this.level.killY) e.y = 40;
  }

  damageEnemy(e, amount, crit, knockback = 0) {
    if (e.dead) return;
    const dmg = Math.max(1, Math.round(amount));
    e.hp -= dmg;
    e.flash = 0.14;
    e.state = e.state === 'windup' ? 'stagger' : e.state;
    e.timer = 0.14;
    if (knockback) e.vx = knockback;
    this.hitstop = Math.max(this.hitstop, 0.025);
    this.audio.sfx('hit');
    this.floatText(e.x + e.w / 2, e.y - 4, String(dmg), crit ? '#ffd76e' : '#fff4cf', crit);
    this.burst(e.x + e.w / 2, e.y + e.h / 2, crit ? 12 : 7, ['#ffd28a', '#e2672c', '#fff4cf'], 90, 140, 1.4);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    e.deathTimer = 0.5;
    this.run.kills++;
    this.run.xp += Math.round(e.cfg.xp * this.difficulty.xp);
    this.audio.sfx('explode');
    this.burst(e.x + e.w / 2, e.y + e.h / 2, 20, ['#f2d18c', '#b43b3b', '#8a7d67'], 130, 160, 1.8);
    this.floatText(e.x + e.w / 2, e.y - 10, `+${Math.round(e.cfg.xp * this.difficulty.xp)} XP`, '#b58ce0');

    // gold
    const coins = irand(1, 3);
    let totalGold = irand(e.cfg.gold[0], e.cfg.gold[1]);
    totalGold = Math.round(totalGold * this.difficulty.gold * (1 + 0.12 * (this.level.map.level - 1)));
    for (let i = 0; i < coins; i++) {
      const value = Math.floor(totalGold / coins) + (i === 0 ? totalGold % coins : 0);
      this.spawnPickup('gold', e.x + e.w / 2, e.y + e.h / 2, { value });
    }
    // materials
    let dropped = false;
    for (const [mat, chance] of e.cfg.drops || []) {
      if (Math.random() < chance) {
        this.spawnPickup('mat', e.x + e.w / 2, e.y + e.h / 2, { mat, value: 1 });
        dropped = true;
      }
    }
    if (e.miniBoss) {
      this.spawnPickup('mat', e.x + e.w / 2, e.y + e.h / 2, { mat: 'scale', value: 1 });
      this.floatText(e.x + e.w / 2, e.y - 22, 'Ogre Warden slain', '#f2d18c');
      this.callbacks.onToast?.('The Ogre Warden falls — dragon scale claimed');
      this.shake = Math.max(this.shake, 9);
    }
    if (e.cfg.ai === 'ogre') {
      this.spawnPickup('heart', e.x + e.w / 2, e.y + e.h / 2, { value: 30 });
    }
  }

  // ============================================================
  // BOSS
  // ============================================================
  startBoss() {
    if (this.bossActive || this.bossDefeated) return;
    const arena = this.level.arena;
    const cfg = BOSS.dragon;
    const hp = Math.round(cfg.hp * this.difficulty.hp);
    this.boss = {
      x: arena.x1 - 300,
      y: arena.floorY - 105,
      baseX: arena.x1 - 300,
      baseY: arena.floorY - 105,
      hp,
      maxHp: hp,
      damage: Math.round(cfg.damage * this.difficulty.dmg),
      phase: 1,
      state: 'intro',
      timer: 1.6,
      atkTimer: 2.0,
      flash: 0,
      contactCd: 0,
      dead: false,
      deathTimer: 0,
      t: 0,
      explodeTick: 0,
      slamTarget: 0,
      face: -1,
      intro: true,
    };
    this.bossActive = true;
    this.introLock = 1.4;
    this.shake = 10;
    this.audio.setMood('boss');
    this.audio.sfx('roar');
    this.callbacks.onToast?.('VAELROS, THE ASHEN WYRM');
    this.pushHud(true);
  }

  bossHitbox() {
    if (!this.boss) return { x: 0, y: 0, w: 0, h: 0 };
    const b = this.boss;
    return { x: b.x - 34, y: b.y - 36, w: 68, h: 72 };
  }

  updateBoss(dt) {
    const b = this.boss;
    const p = this.player;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    if (b.dead) return;
    if (b.state === 'dying') {
      b.deathTimer -= dt;
      b.explodeTick -= dt;
      if (b.explodeTick <= 0) {
        b.explodeTick = 0.18;
        this.burst(b.x + rand(-40, 40), b.y + rand(-40, 40), 12, ['#ffd28a', '#e2672c', '#b43b3b'], 120, 80, 2);
        this.audio.sfx('explode');
        this.shake = Math.max(this.shake, 6);
      }
      if (b.deathTimer <= 0) this.finishBossDeath();
      return;
    }
    if (b.state === 'intro') {
      b.timer -= dt;
      b.y = b.baseY + Math.sin(b.t * 2) * 5;
      if (b.timer <= 0) { b.state = 'hover'; b.intro = false; }
      return;
    }

    // phase transitions
    const ratio = b.hp / b.maxHp;
    const phase = ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
    if (phase > b.phase) {
      b.phase = phase;
      b.state = 'roar';
      b.timer = 1.15;
      b.atkTimer = 1.4;
      this.shake = 12;
      this.audio.sfx('roar');
      this.callbacks.onToast?.(BOSS.dragon.phases[phase - 1]);
      this.burst(b.x, b.y, 34, ['#ffd28a', '#e2672c', '#ff6a4a'], 180, 0, 2.4);
      this.pushHud(true);
    }

    b.contactCd = Math.max(0, b.contactCd - dt);
    if (aabb(this.bossHitbox(), p) && b.contactCd <= 0) {
      this.hurtPlayer(b.damage, b.x, 45);
      b.contactCd = 1.0;
    }

    switch (b.state) {
      case 'hover': {
        b.state = 'hover';
        b.x = clamp(b.baseX + Math.sin(b.t * 0.55) * 48, this.level.arena.x0 + 90, this.level.arena.x1 - 90);
        b.y = b.baseY + Math.sin(b.t * 1.8) * 9;
        b.atkTimer -= dt;
        if (b.atkTimer <= 0) {
          const options = b.phase === 1 ? ['volley', 'slam'] : b.phase === 2 ? ['volley', 'rain', 'slam'] : ['volley', 'rain', 'slam', 'volley'];
          const next = pick(options);
          if (next === 'volley') {
            b.state = 'volley';
            b.timer = 0.65;
            b.atkTimer = 2.8 - b.phase * 0.25;
          } else if (next === 'rain') {
            b.state = 'rain';
            b.timer = 0.6;
            b.atkTimer = 3.4 - b.phase * 0.25;
            b.rainCount = 2 + b.phase;
          } else {
            b.state = 'slamWind';
            b.timer = 0.6;
            b.slamTarget = clamp(p.x + p.w / 2, this.level.arena.x0 + 60, this.level.arena.x1 - 60);
            b.atkTimer = 3.0 - b.phase * 0.2;
          }
        }
        break;
      }
      case 'volley': {
        b.timer -= dt;
        b.face = p.x < b.x ? -1 : 1;
        b.y = b.baseY + Math.sin(b.t * 3) * 3;
        if (b.timer <= 0) {
          const count = 3 + (b.phase - 1) * 2;
          const ox = b.x + b.face * 36;
          const oy = b.y + 18;
          const tx = p.x + p.w / 2;
          const ty = p.y + p.h / 2;
          const baseAng = Math.atan2(ty - oy, tx - ox);
          for (let i = 0; i < count; i++) {
            const spread = (i - (count - 1) / 2) * 0.17;
            const ang = baseAng + spread;
            this.spawnEnemyProjectile('dragonFire', ox, oy, Math.cos(ang) * 170, Math.sin(ang) * 170, b.damage * 0.65, {
              w: 12, h: 12, life: 3.2, explodes: true, radius: 30,
            });
          }
          this.audio.sfx('fireball');
          this.shake = Math.max(this.shake, 4);
          b.state = 'hover';
        }
        break;
      }
      case 'rain': {
        b.timer -= dt;
        b.y = b.baseY + Math.sin(b.t * 2) * 5;
        if (b.timer <= 0) {
          const count = b.rainCount || 4;
          for (let i = 0; i < count; i++) {
            const x = clamp(p.x + p.w / 2 + rand(-160, 160) + (i - count / 2) * 40, this.level.arena.x0 + 30, this.level.arena.x1 - 30);
            this.meteors.push({
              x,
              targetY: this.level.arena.floorY,
              y: this.level.arena.floorY - 220,
              timer: 0.8 + i * 0.08,
              maxTimer: 0.8 + i * 0.08,
              radius: 26,
            });
          }
          this.audio.sfx('skill');
          b.state = 'hover';
        }
        break;
      }
      case 'slamWind': {
        b.timer -= dt;
        b.y = b.baseY - 12 + Math.sin(b.t * 6) * 4;
        if (b.timer <= 0) {
          b.state = 'slamDive';
          b.timer = 0.42;
          b.startX = b.x;
          b.startY = b.y;
        }
        break;
      }
      case 'slamDive': {
        b.timer -= dt;
        const k = clamp(1 - b.timer / 0.42, 0, 1);
        b.x = b.startX + (b.slamTarget - b.startX) * k;
        b.y = b.startY + (this.level.arena.floorY - 32 - b.startY) * k;
        if (b.timer <= 0) {
          this.shockwaves.push({
            x: b.x, y: this.level.arena.floorY, r: 8, maxR: 130,
            life: 0.7, maxLife: 0.7, hit: false, damage: b.damage * 0.8,
          });
          this.shake = 13;
          this.audio.sfx('explode');
          this.burst(b.x, this.level.arena.floorY, 30, ['#ffd28a', '#e2672c', '#b43b3b'], 190, 80, 2.3);
          b.state = 'slamRecover';
          b.timer = 0.85;
        }
        break;
      }
      case 'slamRecover': {
        b.timer -= dt;
        if (b.timer <= 0) {
          b.state = 'hover';
          b.baseX = clamp(this.level.arena.x1 - 300, this.level.arena.x0 + 100, this.level.arena.x1 - 100);
        }
        break;
      }
      case 'roar': {
        b.timer -= dt;
        this.shake = Math.max(this.shake, 4);
        if (b.timer <= 0) { b.state = 'hover'; }
        break;
      }
      default:
        b.state = 'hover';
    }

    b.face = p.x < b.x ? -1 : 1;
  }

  damageBoss(amount, crit) {
    const b = this.boss;
    if (!b || b.dead || b.state === 'dying' || b.state === 'intro') return;
    const dmg = Math.max(1, Math.round(amount));
    b.hp -= dmg;
    b.flash = 0.12;
    this.hitstop = Math.max(this.hitstop, 0.035);
    this.audio.sfx('hit');
    this.floatText(b.x + rand(-16, 16), b.y - 52, String(dmg), crit ? '#ffd76e' : '#fff4cf', crit);
    this.burst(b.x + rand(-30, 30), b.y + rand(-20, 20), crit ? 16 : 9, ['#ffd28a', '#e2672c', '#fff4cf'], 100, 40, 1.8);
    this.pushHud(true);
    if (b.hp <= 0) {
      b.hp = 0;
      b.state = 'dying';
      b.deathTimer = 2.3;
      b.explodeTick = 0.05;
      this.shake = 14;
      this.audio.sfx('roar');
      this.bossDefeated = true;
      this.run.bossKilled = true;
      this.run.xp += Math.round(BOSS.dragon.xp * this.difficulty.xp);
      b.hoardGold = Math.round(rand(220, 300) * this.difficulty.gold);
      this.callbacks.onToast?.('Vaelros is breaking apart!');
    }
  }

  finishBossDeath() {
    const b = this.boss;
    const arena = this.level.arena;
    this.audio.sfx('explode');
    // The wyrm's last breath should not kill the hero after the duel.
    this.projectiles = this.projectiles.filter(p => p.owner === 'player');
    this.meteors = [];
    this.shockwaves = [];
    this.burst(b.x, b.y, 60, ['#ffd28a', '#e2672c', '#fff4cf', '#b43b3b'], 260, 60, 2.8);
    this.burst(arena.x0 + 760 / 2, arena.floorY - 20, 40, ['#ffd28a', '#fff4cf'], 220, 30, 2.4);
    this.shake = 16;

    // The dragon drops a visible hoard instead of silently crediting loot.
    const cx = b.x;
    const cy = Math.min(arena.floorY - 24, b.y + 12);
    const hoard = b.hoardGold || Math.round(rand(220, 300) * this.difficulty.gold);
    const piles = 7;
    for (let i = 0; i < piles; i++) {
      const value = Math.floor(hoard / piles) + (i < hoard % piles ? 1 : 0);
      this.spawnPickup('gold', cx + rand(-65, 65), cy + rand(-25, 20), { value, magnetDelay: 1.1 });
    }
    for (let i = 0; i < 3; i++) {
      this.spawnPickup('mat', cx + rand(-55, 55), cy + rand(-20, 10), { mat: 'scale', value: 1, magnetDelay: 1.1 });
    }
    this.spawnPickup('mat', cx + rand(-50, 50), cy, { mat: 'crystal', value: 2, magnetDelay: 1.1 });
    this.spawnPickup('mat', cx + rand(-50, 50), cy, { mat: 'iron', value: 3, magnetDelay: 1.1 });

    this.bossActive = false;
    this.boss = null;
    this.portal = { x: arena.x0 + 760 / 2 - 13, y: arena.floorY - 42, w: 26, h: 42, active: true };
    this.callbacks.onToast?.('Vaelros has fallen — loot the hoard. The shard gate is open.');
    this.audio.setMood('victory');
    this.pushHud(true);
  }

  // ============================================================
  // PICKUPS, PARTICLES, TEXTS, CAMERA
  // ============================================================
  spawnPickup(kind, x, y, data = {}) {
    this.pickups.push({
      kind,
      x, y,
      w: kind === 'heart' ? 10 : 8,
      h: kind === 'heart' ? 9 : 8,
      vx: rand(-60, 60),
      vy: rand(-230, -140),
      life: 0,
      value: data.value || 1,
      mat: data.mat,
      magnetDelay: data.magnetDelay || 0,
      collected: false,
      magnet: false,
    });
  }

  updatePickups(dt) {
    const p = this.player;
    if (!p) return;
    const px = p.x + p.w / 2;
    const py = p.y + p.h / 2;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.life += dt;
      const dx = px - pk.x;
      const dy = py - pk.y;
      const dist = Math.hypot(dx, dy);
      const magnetReady = pk.life >= (pk.magnetDelay || 0);
      if (dist < 95 && magnetReady) pk.magnet = true;
      if (pk.life > 2.6 && magnetReady) pk.magnet = true;
      if (pk.magnet) {
        const sp = 430;
        pk.vx = (dx / (dist || 1)) * sp;
        pk.vy = (dy / (dist || 1)) * sp;
        pk.x += pk.vx * dt;
        pk.y += pk.vy * dt;
      } else {
        pk.vy += 900 * dt;
        pk.x += pk.vx * dt;
        pk.y += pk.vy * dt;
        // bounce on ground
        const top = topAt(this.level, pk.x);
        if (top != null && pk.y > top - 6) {
          pk.y = top - 6;
          pk.vy *= -0.35;
          pk.vx *= 0.7;
          if (Math.abs(pk.vy) < 30) pk.vy = 0;
        }
      }
      if ((dist < 14 && magnetReady) || pk.life > 6) {
        this.collectPickup(pk);
        this.pickups.splice(i, 1);
      }
    }
  }

  collectPickup(pk) {
    if (pk.collected) return;
    pk.collected = true;
    if (pk.kind === 'gold') {
      this.run.gold += pk.value;
      this.audio.sfx('coin');
      this.floatText(pk.x, pk.y - 5, `+${pk.value}`, '#f7df9f');
    } else if (pk.kind === 'mat') {
      this.run.materials[pk.mat] = (this.run.materials[pk.mat] || 0) + pk.value;
      this.audio.sfx('material');
      this.floatText(pk.x, pk.y - 5, `+${pk.value} ${MATERIALS[pk.mat]?.short || ''}`, MATERIALS[pk.mat]?.color || '#fff');
    } else if (pk.kind === 'heart') {
      const heal = pk.value || 20;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      this.audio.sfx('potion');
      this.floatText(pk.x, pk.y - 5, `+${heal}`, '#9be08a');
    }
    this.pushHud(true);
  }

  collectAllPickups() {
    for (const pk of this.pickups) this.collectPickup(pk);
    this.pickups = [];
  }

  burst(x, y, count, colors, speed, gravity, size) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 360) break;
      const ang = rand(0, Math.PI * 2);
      const sp = rand(speed * 0.35, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: rand(0.25, 0.7),
        maxLife: 0.7,
        color: pick(colors),
        size: rand(0.8, (size || 1.5) * 1.6),
        gravity: gravity || 0,
        kind: 'square',
      });
    }
  }

  ring(x, y, r, maxR, color, life) {
    this.particles.push({ x, y, vx: 0, vy: 0, life, maxLife: life, color, size: 1, kind: 'ring', r, maxR });
  }

  spawnAfterimage() {
    const p = this.player;
    this.particles.push({
      x: p.x, y: p.y, vx: 0, vy: 0,
      life: 0.22, maxLife: 0.22,
      color: this.hero.color, size: 1,
      kind: 'afterimage', facing: p.facing,
    });
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      if (p.kind === 'ring') {
        p.r = lerp(p.r, p.maxR, 1 - Math.exp(-8 * dt));
      } else if (p.kind !== 'afterimage') {
        p.vy += (p.gravity || 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.97;
        p.vy *= 0.98;
      }
    }
  }

  floatText(x, y, text, color = '#fff', big = false) {
    this.texts.push({ x, y, text, color, life: 0.85, maxLife: 0.85, big });
  }

  updateTexts(dt) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 22 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  updateMeteors(dt) {
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.timer -= dt;
      if (m.timer <= 0) {
        this.explode(m.x, m.targetY - 8, m.radius + 8, this.boss?.damage ? this.boss.damage * 0.55 : 12, 'enemy');
        this.meteors.splice(i, 1);
        this.audio.sfx('explode');
        this.shake = Math.max(this.shake, 5);
      }
    }
  }

  updateShockwaves(dt) {
    const p = this.player;
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.life -= dt;
      const k = 1 - s.life / s.maxLife;
      s.r = 8 + (s.maxR - 8) * k;
      if (!s.hit) {
        const dist = Math.hypot((p.x + p.w / 2) - s.x, (p.y + p.h) - s.y);
        if (dist < s.r && p.invuln <= 0) {
          s.hit = true;
          this.hurtPlayer(s.damage, s.x, 40);
        }
      }
      if (s.life <= 0) this.shockwaves.splice(i, 1);
    }
  }

  updateCamera(dt) {
    const p = this.player;
    let tx = p.x + p.w / 2 - VIEW_W / 2 + p.facing * 24;
    let minX = 0;
    let maxX = Math.max(0, this.level.width - VIEW_W);
    if (this.bossActive && this.level.arena) {
      minX = this.level.arena.x0;
      maxX = Math.max(minX, this.level.arena.x1 - VIEW_W);
    }
    tx = clamp(tx, minX, maxX);
    const ty = clamp(p.y + p.h / 2 - VIEW_H * 0.62, 0, this.level.height - VIEW_H);
    const k = 1 - Math.exp(-7 * dt);
    this.cam.x = lerp(this.cam.x, tx, k);
    this.cam.y = lerp(this.cam.y, ty, k);
    if (this.bossActive && this.boss) {
      // boss HP is pushed through hud
    }
  }

  drawAmbient(dt) {
    if (this.save.settings?.reduceMotion) return;
    if (this.level.map.theme === 'peak' && Math.random() < 0.5) {
      this.particles.push({
        x: this.cam.x + rand(-20, VIEW_W + 20),
        y: this.cam.y + rand(-10, 20),
        vx: rand(-8, 8), vy: rand(14, 32),
        life: rand(2, 4), maxLife: 4,
        color: 'rgba(205, 185, 170, 0.4)', size: rand(0.6, 1.2), kind: 'square', gravity: 0,
      });
    }
    if (this.level.map.theme === 'keep' && Math.random() < 0.15) {
      this.particles.push({
        x: this.cam.x + rand(0, VIEW_W), y: this.cam.y + rand(0, VIEW_H),
        vx: rand(-4, 4), vy: rand(-12, -3),
        life: rand(1.5, 3), maxLife: 3,
        color: 'rgba(226,180,120,0.3)', size: rand(0.5, 1), kind: 'square', gravity: 0,
      });
    }
  }

  // ============================================================
  // HUD SNAPSHOT
  // ============================================================
  pushHud(force = false) {
    if (!this.callbacks.onHud || !this.player) return;
    const p = this.player;
    const skill = this.hero.skill;
    const remaining = p.skillCd;
    const interact = this.nearestInteractive();
    let objective = 'Reach the shard gate';
    if (this.level.map.boss) objective = this.bossDefeated ? 'Enter the shard gate' : this.bossActive ? 'Slay Vaelros' : 'Climb to the wyrm’s lair';
    const progressX = this.portal ? this.portal.x : this.level.bossTriggerX || this.level.width - 100;
    const progress = clamp(p.x / Math.max(1, progressX), 0, 1);
    const snap = {
      heroId: this.run.heroId,
      heroName: this.hero.name,
      shortName: this.hero.short,
      level: this.power.level,
      hp: Math.max(0, Math.round(p.hp)),
      maxHp: p.maxHp,
      potions: p.potions,
      gold: this.run.gold,
      skillName: skill.name,
      skillIcon: skill.icon,
      skillCooldown: skill.cooldown,
      skillRemaining: remaining,
      regen: (this.hero.id === 'warrior' || p.regenDelay <= 0) && p.hp > 0 && p.hp < p.maxHp,
      regenRate: Math.max(REGEN.min, p.maxHp * REGEN.rate),
      mapName: this.level.map.name,
      mapNumeral: this.level.map.numeralWord,
      difficulty: this.difficulty.name,
      objective,
      progress,
      interact: interact ? interact.label : null,
      boss: this.boss && !this.boss.dead ? {
        name: BOSS.dragon.name,
        phase: this.boss.phase,
        sub: BOSS.dragon.sub[this.boss.phase - 1],
        hp: this.boss.hp,
        maxHp: this.boss.maxHp,
        deathTimer: this.boss.deathTimer,
      } : null,
      elapsed: this.run.time,
    };
    this.callbacks.onHud(snap, force);
  }

  // ============================================================
  // RENDER
  // ============================================================
  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 1280, 720);
    ctx.imageSmoothingEnabled = false;

    const shakeX = this.shake > 0.1 ? rand(-this.shake, this.shake) * 0.5 : 0;
    const shakeY = this.shake > 0.1 ? rand(-this.shake, this.shake) * 0.35 : 0;
    const shakeAllowed = this.save.settings?.shake !== false && !this.save.settings?.reduceMotion;
    const view = {
      x: Math.round(this.cam.x + (shakeAllowed ? shakeX : 0)),
      y: Math.round(this.cam.y + (shakeAllowed ? shakeY : 0)),
    };

    // background in screen space (parallax)
    ctx.save();
    ctx.scale(SCALE, SCALE);
    drawBackground(ctx, { x: view.x, y: view.y }, this.level.map.theme, this.time, this.assets);
    ctx.restore();

    // world
    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.translate(-view.x, -view.y);

    drawDecor(ctx, this.level, view, this.assets, this.time);
    drawTerrain(ctx, this.level, view, this.assets);
    this.drawPlayerLight(ctx);
    this.drawTorchGlow(ctx, view);
    this.drawCheckpointsAndChests(ctx);
    this.drawPortal(ctx);
    this.drawPickups(ctx);
    this.drawMeteorWarnings(ctx);
    this.drawEnemies(ctx);
    this.drawPlayer(ctx);
    this.drawBoss(ctx);
    this.drawProjectiles(ctx);
    this.drawShockwaves(ctx);
    this.drawParticles(ctx);
    this.drawTexts(ctx);
    ctx.restore();

    // foreground atmosphere
    ctx.save();
    ctx.scale(SCALE, SCALE);
    this.drawForeground(ctx);
    ctx.restore();
  }

  drawPlayerLight(ctx) {
    if (!this.player || this.level.map.theme !== 'keep') return;
    const p = this.player;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 76);
    g.addColorStop(0, 'rgba(255, 190, 120, 0.10)');
    g.addColorStop(0.5, 'rgba(255, 160, 90, 0.045)');
    g.addColorStop(1, 'rgba(255, 120, 50, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 80, cy - 80, 160, 160);
    ctx.restore();
  }

  drawTorchGlow(ctx, view) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of this.level.decor) {
      if (d.kind !== 'torch') continue;
      if (d.x < view.x - 40 || d.x > view.x + VIEW_W + 40) continue;
      const flicker = 0.75 + Math.sin(this.time * 9 + d.x) * 0.12;
      const g = ctx.createRadialGradient(d.x, d.y - 6, 1, d.x, d.y - 6, 42 * flicker);
      g.addColorStop(0, 'rgba(255, 185, 100, 0.26)');
      g.addColorStop(1, 'rgba(255, 120, 50, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(d.x - 44, d.y - 48, 88, 88);
    }
    if (this.portal) {
      const g = ctx.createRadialGradient(this.portal.x + 13, this.portal.y + 20, 2, this.portal.x + 13, this.portal.y + 20, 50);
      g.addColorStop(0, 'rgba(255, 214, 150, 0.25)');
      g.addColorStop(1, 'rgba(226, 103, 44, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(this.portal.x - 38, this.portal.y - 30, 100, 100);
    }
    ctx.restore();
  }

  drawCheckpointsAndChests(ctx) {
    for (const cp of this.checkpoints) {
      if (cp.x < this.cam.x - 40 || cp.x > this.cam.x + VIEW_W + 40) continue;
      drawCheckpoint(ctx, cp, this.assets, this.time);
    }
    for (const c of this.chests) {
      if (c.x < this.cam.x - 40 || c.x > this.cam.x + VIEW_W + 40) continue;
      drawChest(ctx, c, this.assets, this.time);
    }
  }

  drawPortal(ctx) {
    if (!this.portal) return;
    if (this.portal.x < this.cam.x - 80 || this.portal.x > this.cam.x + VIEW_W + 80) return;
    drawPortal(ctx, this.portal, this.time);
  }

  drawPickups(ctx) {
    for (const pk of this.pickups) {
      if (pk.x < this.cam.x - 30 || pk.x > this.cam.x + VIEW_W + 30) continue;
      const bob = Math.sin(this.time * 5 + pk.x) * 1.2;
      let img = null;
      let w = 9;
      let h = 9;
      if (pk.kind === 'gold') { img = this.assets.iconImages.gold; w = 8; h = 8; }
      else if (pk.kind === 'mat') { img = this.assets.iconImages[pk.mat]; w = 9; h = 9; }
      else if (pk.kind === 'heart') { w = 9; h = 8; }
      if (pk.kind === 'heart') {
        drawImageArt(ctx, this.assets.ppImg(44), pk.x - w / 2, pk.y - h / 2 + bob, w, h);
      } else if (img) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.drawImage(img, pk.x - w / 2, pk.y - h / 2 + bob, w, h);
        ctx.restore();
      }
      // glow
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(pk.x, pk.y + bob, 0, pk.x, pk.y + bob, 14);
      g.addColorStop(0, pk.kind === 'gold' ? 'rgba(255, 220, 140, 0.22)' : 'rgba(160, 220, 255, 0.14)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(pk.x - 14, pk.y - 14 + bob, 28, 28);
      ctx.restore();
    }
  }

  drawMeteorWarnings(ctx) {
    for (const m of this.meteors) {
      const k = clamp(1 - m.timer / m.maxTimer, 0, 1);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 110, 60, ${0.25 + 0.55 * k})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(m.x, m.targetY, m.radius, m.radius * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(226, 80, 40, ${0.06 + 0.1 * k})`;
      ctx.beginPath();
      ctx.ellipse(m.x, m.targetY, m.radius, m.radius * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      const fy = m.targetY - 210 * (1 - k) - 20;
      const grad = ctx.createRadialGradient(m.x, fy, 1, m.x, fy, 12);
      grad.addColorStop(0, 'rgba(255, 240, 190, 0.95)');
      grad.addColorStop(0.4, 'rgba(255, 140, 60, 0.75)');
      grad.addColorStop(1, 'rgba(180, 40, 20, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(m.x - 14, fy - 14, 28, 28);
      ctx.restore();
    }
  }

  drawEnemies(ctx) {
    for (const e of this.enemies) {
      if (e.x < this.cam.x - 60 || e.x > this.cam.x + VIEW_W + 60) continue;
      const cfg = e.cfg;
      const fade = e.dead ? clamp(e.deathTimer / 0.5, 0, 1) : 1;
      const bob = e.dead ? 0 : Math.sin(e.anim * 5) * 0.6;
      const s = e.scale;
      const w = 16 * s;
      const h = 16 * s;
      const dx = e.x + e.w / 2 - w / 2;
      const dy = e.y + e.h - h + bob;
      // shadow
      if (!cfg.flying) {
        ctx.fillStyle = 'rgba(3, 2, 6, 0.28)';
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h - 1, e.w * 0.55, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.globalAlpha = fade;
      if (e.facing > 0) {
        ctx.translate(dx + w / 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(this.assets.tinyImg(cfg.sprite), -w / 2, dy, w, h);
      } else {
        ctx.drawImage(this.assets.tinyImg(cfg.sprite), dx, dy, w, h);
      }
      if (e.flash > 0) {
        ctx.globalAlpha = 0.45 + Math.sin(this.time * 40) * 0.15;
        ctx.fillStyle = '#fff4cf';
        ctx.fillRect(dx, dy, w, h);
      }
      ctx.restore();

      // telegraph
      if (e.telegraph > 0) {
        const a = 0.5 + 0.5 * Math.sin(this.time * 22);
        ctx.fillStyle = `rgba(255, 80, 50, ${0.5 + a * 0.4})`;
        ctx.font = '700 9px "Alegreya Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', e.x + e.w / 2, e.y - 9);
      }

      // mini-boss / damaged enemy health
      if (!e.dead && (e.miniBoss || e.hp < e.maxHp)) {
        const bw = e.miniBoss ? 42 : 18;
        const bx = e.x + e.w / 2 - bw / 2;
        const by = e.y - (e.miniBoss ? 12 : 7);
        ctx.fillStyle = 'rgba(4,3,7,0.7)';
        ctx.fillRect(bx, by, bw, e.miniBoss ? 4 : 2.5);
        ctx.fillStyle = e.miniBoss ? '#b43b3b' : '#d05b4c';
        ctx.fillRect(bx, by, bw * clamp(e.hp / e.maxHp, 0, 1), e.miniBoss ? 4 : 2.5);
        if (e.miniBoss) {
          ctx.strokeStyle = 'rgba(237,220,184,0.45)';
          ctx.lineWidth = 0.6;
          ctx.strokeRect(bx, by, bw, 4);
          ctx.fillStyle = 'rgba(237,220,184,0.85)';
          ctx.font = '600 4px "Alegreya Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('OGRE WARDEN', e.x + e.w / 2, by - 2);
        }
      }
    }
  }

  drawPlayer(ctx) {
    const p = this.player;
    if (!p) return;
    if (p.invuln > 0 && Math.sin(this.time * 40) > 0.5) return;
    const bob = p.onGround && Math.abs(p.vx) > 10 ? Math.sin(p.animTime * 16) * 0.7 : Math.sin(p.animTime * 3) * 0.5;
    const sprite = this.assets.heroImg(this.hero.id);
    const px = p.x + p.w / 2;
    const py = p.y + p.h;

    // shadow
    ctx.fillStyle = 'rgba(3, 2, 6, 0.4)';
    ctx.beginPath();
    ctx.ellipse(px, py - 1, 7, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // dash trail
    if (p.dashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = this.hero.color;
      ctx.fillRect(px - p.facing * 14, p.y + 3, 8, 10);
      ctx.restore();
    }

    // weapon behind/in front
    this.drawWeapon(ctx, px, py, bob);

    ctx.save();
    // All hero sheets face right in the source art; the mage was corrected
    // separately before this. Flip the body when moving left only.
    const flipBody = p.facing < 0;
    if (flipBody) {
      ctx.translate(px, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, -8, py - 16 + bob, 16, 16);
    } else {
      ctx.drawImage(sprite, px - 8, py - 16 + bob, 16, 16);
    }
    ctx.restore();

    if (p.hurtFlash > 0) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#ff5a4a';
      ctx.fillRect(px - 6, py - 14 + bob, 12, 14);
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#ffd6c2';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(px - 6, py - 14 + bob, 12, 14);
      ctx.restore();
    }

    // low HP / potion? HUD handles
    if (p.spinTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255, 216, 142, 0.55)';
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 2; i++) {
        const rr = 20 + i * 8 + Math.sin(this.time * 30 + i) * 2;
        ctx.beginPath();
        ctx.arc(px, p.y + p.h / 2, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawWeapon(ctx, px, py, bob) {
    const p = this.player;
    const cls = this.hero.id;
    const t = this.time;
    const swing = p.attackTimer > 0 ? (1 - p.attackTimer / 0.22) : 0;
    ctx.save();
    if (cls === 'warrior') {
      const dir = p.facing;
      const angle = swing > 0 ? (-0.95 + swing * 2.05) : 0.28;
      ctx.translate(px + dir * 7, py - 8 + bob);
      ctx.scale(dir, 1);
      ctx.rotate(angle);
      ctx.drawImage(this.assets.tinyImg(104), -1, -13, 7, 15);
      if (swing > 0) {
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#ffe3aa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -4, 19, -1.35, 1.1);
        ctx.stroke();
      }
    } else if (cls === 'mage') {
      const dir = p.facing;
      ctx.translate(px + dir * 8, py - 7 + bob);
      ctx.scale(dir, 1);
      ctx.rotate(-0.1);
      ctx.drawImage(this.assets.tinyImg(129), -2, -16, 8, 18);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(1, -15, 0, 1, -15, 7);
      g.addColorStop(0, 'rgba(255, 226, 160, 0.9)');
      g.addColorStop(1, 'rgba(255, 140, 60, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(-6, -22, 14, 14);
    } else {
      const dir = p.facing;
      ctx.translate(px + dir * 6, py - 8 + bob);
      ctx.scale(dir, 1);
      if (swing > 0) ctx.rotate(-0.55 + swing * 0.45);
      else ctx.rotate(-0.08);
      ctx.drawImage(this.assets.iconImages.bow, -2, -12, 8, 16);
      if (swing > 0) {
        ctx.strokeStyle = '#e6ddc8';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(2, -9);
        ctx.lineTo(10, 1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawBoss(ctx) {
    const b = this.boss;
    if (!b) return;
    if (b.x < this.cam.x - 160 || b.x > this.cam.x + VIEW_W + 160) return;
    const float = Math.sin(b.t * 1.8) * 6;
    const img = this.assets.dragon;
    if (!img) return;
    const s = 1.45;
    const w = 100 * s;
    const h = 100 * s;
    // shadow
    ctx.save();
    ctx.fillStyle = 'rgba(2, 1, 5, 0.35)';
    ctx.beginPath();
    ctx.ellipse(b.x, this.level.arena.floorY - 2, 55, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // aura
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const aura = ctx.createRadialGradient(b.x, b.y + float, 10, b.x, b.y + float, 90);
    aura.addColorStop(0, `rgba(255, 110, 50, ${b.phase === 3 ? 0.22 : 0.12})`);
    aura.addColorStop(1, 'rgba(255, 70, 30, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(b.x - 100, b.y - 100 + float, 200, 200);
    ctx.restore();

    ctx.save();
    ctx.translate(b.x, b.y + float);
    ctx.scale(b.face, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    if (b.flash > 0) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#fff4cf';
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();

    // mouth glow during volley
    if (b.state === 'volley') {
      const mx = b.x + b.face * 30;
      const my = b.y + 18 + float;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, 20);
      g.addColorStop(0, 'rgba(255, 242, 190, 0.8)');
      g.addColorStop(0.4, 'rgba(255, 120, 50, 0.5)');
      g.addColorStop(1, 'rgba(255, 60, 20, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(mx - 22, my - 22, 44, 44);
      ctx.restore();
    }

    // slam warning
    if (b.state === 'slamWind' || b.state === 'slamDive') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 94, 50, 0.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(b.slamTarget, this.level.arena.floorY, 34, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 70, 30, 0.1)';
      ctx.beginPath();
      ctx.ellipse(b.slamTarget, this.level.arena.floorY, 34, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawProjectiles(ctx) {
    for (const pr of this.projectiles) {
      if (pr.x < this.cam.x - 40 || pr.x > this.cam.x + VIEW_W + 40) continue;
      ctx.save();
      if (pr.kind === 'playerArrow' || pr.kind === 'rainArrow') {
        ctx.translate(pr.x, pr.y);
        ctx.rotate(pr.angle);
        ctx.fillStyle = '#d9c9a4';
        ctx.fillRect(-6, -0.5, 10, 1);
        ctx.fillStyle = '#c9d4dd';
        ctx.beginPath();
        ctx.moveTo(4, -2); ctx.lineTo(7, 0); ctx.lineTo(4, 2); ctx.fill();
        ctx.fillStyle = '#8fa56e';
        ctx.fillRect(-6, -1.5, 3, 3);
      } else if (pr.kind === 'playerFire' || pr.kind === 'dragonFire') {
        const isDragon = pr.kind === 'dragonFire';
        const g = ctx.createRadialGradient(pr.x, pr.y, 1, pr.x, pr.y, isDragon ? 15 : 12);
        g.addColorStop(0, 'rgba(255, 246, 200, 1)');
        g.addColorStop(0.35, isDragon ? 'rgba(255, 150, 60, 0.95)' : 'rgba(255, 190, 100, 0.9)');
        g.addColorStop(1, isDragon ? 'rgba(200, 40, 20, 0)' : 'rgba(255, 110, 40, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(pr.x - 16, pr.y - 16, 32, 32);
        ctx.fillStyle = 'rgba(255, 240, 200, 0.9)';
        ctx.fillRect(pr.x - 1.5, pr.y - 1.5, 3, 3);
        // trail
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = isDragon ? '#ff6a3a' : '#ffb066';
        ctx.fillRect(pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02, 4, 4);
      } else if (pr.kind === 'bone') {
        ctx.translate(pr.x, pr.y);
        ctx.rotate(pr.angle + this.time * 6);
        ctx.drawImage(this.assets.iconImages.bone, -3.5, -2.5, 8, 6);
      }
      ctx.restore();
    }
  }

  drawShockwaves(ctx) {
    for (const s of this.shockwaves) {
      const a = clamp(s.life / s.maxLife, 0, 1);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 140, 70, ${a * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      if (p.x < this.cam.x - 40 || p.x > this.cam.x + VIEW_W + 40) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      if (p.kind === 'ring') {
        ctx.globalAlpha = a * 0.7;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'slash') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const start = p.facing > 0 ? -1.15 : Math.PI - 1.25;
        const end = p.facing > 0 ? 1.15 : Math.PI + 1.25;
        ctx.arc(p.x, p.y, p.radius, start, end);
        ctx.stroke();
        ctx.globalAlpha = a * 0.25;
        ctx.lineWidth = 4;
        ctx.stroke();
      } else if (p.kind === 'afterimage') {
        ctx.globalAlpha = a * 0.28;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 5, p.y + 2, 10, 13);
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.restore();
    }
  }

  drawTexts(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const a = clamp(t.life / t.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `${t.big ? '700 8px' : '600 6px'} "Alegreya Sans", sans-serif`;
      ctx.fillStyle = 'rgba(3, 2, 6, 0.65)';
      ctx.fillText(t.text, t.x + 0.6, t.y + 0.6);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  drawForeground(ctx) {
    // screen-space low smoke at the very bottom
    const g = ctx.createLinearGradient(0, VIEW_H - 22, 0, VIEW_H);
    g.addColorStop(0, 'rgba(5, 4, 9, 0)');
    g.addColorStop(1, 'rgba(5, 4, 9, 0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, VIEW_H - 22, VIEW_W, 22);
  }

  // compatibility alias used by older builds
  get assetsBow() { return this.assets.icons.bow; }
}

// helper used before class definition
function drawImageArt(ctx, img, x, y, w, h) {
  if (img) ctx.drawImage(img, x, y, w, h);
}

// ============================================================
// EMBERFALL — asset loader & procedural pixel icons
// ============================================================

const TINY_COUNT = 132;
const PP_COUNT = 180;

function pad4(n) { return String(n).padStart(4, '0'); }

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn('[Emberfall] Missing asset:', src);
      resolve(null);
    };
    img.src = src;
  });
}

export function tinyPath(index) {
  return `assets/tiny-dungeon/tiles/tile_${pad4(index)}.png`;
}
export function ppPath(index) {
  return `assets/pixel-platformer/tiles/tile_${pad4(index)}.png`;
}

// ------------------------------------------------------------------
// tiny pixel-art canvas builder (16x16 mostly)
// ------------------------------------------------------------------
function art(rows, palette) {
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const col = palette[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

function toURL(canvas) { return canvas.toDataURL('image/png'); }

function contentBottom(canvas) {
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let y = canvas.height - 1; y >= 0; y--) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 8) return y + 1;
    }
  }
  return canvas.height;
}

const P = {
  coin: art([
    '................',
    '.....dddddd.....',
    '...ddlllllldd...',
    '..dlllllllllld..',
    '.dllllgggglllld.',
    '.dlllggggggllld.',
    'dlllggllllggllld',
    'dlllggllllggllld',
    'dlllggllllggllld',
    'dlllggllllggllld',
    '.dlllggggggllld.',
    '.dllllgggglllld.',
    '..dlllllllllld..',
    '...ddlllllldd...',
    '.....dddddd.....',
    '................',
  ], { d: '#8a5a1d', l: '#e8b95c', g: '#f7df9f' }),

  iron: art([
    '................',
    '................',
    '......gggg......',
    '....ggllllgg....',
    '...glllllhhhg...',
    '..glllllhhhhgg..',
    '..gllllllhhllg..',
    '.gllllllllllllg.',
    '.glllllhhlllllg.',
    '.gllllhhhhllllg.',
    '..gllllllllllg..',
    '...ggllllllgg...',
    '.....gggggg.....',
    '................',
    '................',
    '................',
  ], { g: '#5d6672', l: '#aebac6', h: '#e3ebf1' }),

  leather: art([
    '................',
    '................',
    '....dd..dd......',
    '...dbbddbbd.....',
    '..dbbbbbbbbd....',
    '.dbbbbbbbbbbd...',
    '.dbhbbbbbbbbd...',
    '.dbbbbbbbbbbd...',
    '.dbbbbbbbhhbd...',
    '..dbbbbbbbbd....',
    '...dbbbbbbd.....',
    '....ddbbdd......',
    '.....dddd.......',
    '................',
    '................',
    '................',
  ], { d: '#5c3a20', b: '#b9855a', h: '#e0b184' }),

  crystal: art([
    '................',
    '.......gg.......',
    '......gllg......',
    '.....gllllg.....',
    '....glllhlg.....',
    '....gllhhllg....',
    '...glllhhlllg...',
    '...gllllllllg...',
    '....gllllllg....',
    '....glllllg.....',
    '.....glllg......',
    '......glg.......',
    '.......g........',
    '................',
    '................',
    '................',
  ], { g: '#2c7f8e', l: '#7ed6e0', h: '#e5ffff' }),

  wood: art([
    '................',
    '................',
    '.......ggg......',
    '......glllg.....',
    '.....glllllg....',
    '....dddddddd....',
    '...dbbbbbbbbd...',
    '..dbbhbbbbbbbd..',
    '..dbhbbbbbbbbd..',
    '..dbbbbbbbbbbd..',
    '..dbbbbbbbbbbd..',
    '..dbbbbbbhbbbd..',
    '...dddddddddd...',
    '................',
    '................',
    '................',
  ], { g: '#496c31', l: '#8fbe62', d: '#4a2f1a', b: '#8a5a33', h: '#c08a57' }),

  scale: art([
    '................',
    '......dddd......',
    '.....dooood.....',
    '....doohhoood...',
    '...doohhhhoood..',
    '...doohhhhoood..',
    '..dooohhhhooood.',
    '..doooohhoooood.',
    '..doooooooooood.',
    '...dooooooooood.',
    '...ddooooooood..',
    '....ddooooood...',
    '.....dddddd.....',
    '................',
    '................',
    '................',
  ], { d: '#6d2118', o: '#c65031', h: '#f0a26f' }),

  potion: art([
    '................',
    '......dddd......',
    '......dggd......',
    '......dggd......',
    '.....dggggd.....',
    '....dggggggd....',
    '...dggllllggd...',
    '...dgllllllgd...',
    '...dgllhhllgd...',
    '...dgllllllgd...',
    '...ddgllllgdd...',
    '....ddggggdd....',
    '.....dddddd.....',
    '................',
    '................',
    '................',
  ], { d: '#4a1616', g: '#8f2f2f', l: '#d24a45', h: '#ff8f7a' }),

  arrow: art([
    '................',
    '................',
    '................',
    '..ffgggggggggaa.',
    '.fffgggggggggaaa',
    '..ffgggggggggaa.',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ], { f: '#e6ddc8', g: '#8a5a33', a: '#c9d4dd' }),

  bone: art([
    '................',
    '................',
    '..dd............',
    '.dllgd..........',
    '.dlllld.........',
    '..dllld.........',
    '...dlld.........',
    '....dld.........',
    '.....dd.........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ], { d: '#8a7d67', l: '#e6ddc8', g: '#b8ac93' }),
};

const BOW_ROWS = [
  '................',
  '..........bb....',
  '.........b..b...',
  '........b....b..',
  '.......b..s..b..',
  '......b...s...b.',
  '.....b....s....b',
  '.....b....s....b',
  '.....b....s....b',
  '.....b....s....b',
  '......b...s...b.',
  '.......b..s..b..',
  '........b....b..',
  '.........b..b...',
  '..........bb....',
  '................',
];
const bowCanvas = art(BOW_ROWS, { b: '#7d4c25', s: '#d8cba9' });
// lighter highlight on the belly of the bow
{
  const ctx = bowCanvas.getContext('2d');
  ctx.fillStyle = '#b07a3f';
  [[5, 6], [5, 7], [4, 8], [4, 9], [5, 10]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
}

// ============================================================
// Assets
// ============================================================
export class Assets {
  constructor() {
    this.tiny = [];
    this.pp = [];
    this.dragon = null;
    this.icons = {};
    this.ready = false;
  }

  async load(onProgress = () => {}) {
    // Two small atlases instead of 312 individual requests. This keeps boot
    // fast on phones and avoids hammering simple static servers.
    const [tinySheet, ppSheet, dragonImg] = await Promise.all([
      loadImage('assets/tiny-dungeon/tiny-atlas.png?v=3'),
      loadImage('assets/pixel-platformer/pixel-atlas.png?v=3'),
      loadImage('assets/dragon/dragon.png'),
    ]);
    this.dragon = dragonImg;
    onProgress(0.55);

    const makeTile = (sheet, index, cols) => {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const cx = c.getContext('2d');
      cx.imageSmoothingEnabled = false;
      if (sheet) {
        cx.drawImage(sheet, (index % cols) * 16, Math.floor(index / cols) * 16, 16, 16, 0, 0, 16, 16);
      }
      // Give canvases a src so existing <img> UI can use the same art.
      c.src = c.toDataURL('image/png');
      c.__bottom = contentBottom(c);
      return c;
    };

    if (tinySheet) {
      for (let i = 0; i < TINY_COUNT; i++) this.tiny[i] = makeTile(tinySheet, i, 12);
    } else {
      // Fallback: old per-tile loading path.
      const imgs = await Promise.all(Array.from({ length: TINY_COUNT }, (_, i) => loadImage(tinyPath(i))));
      for (let i = 0; i < imgs.length; i++) this.tiny[i] = imgs[i];
    }
    onProgress(0.76);

    if (ppSheet) {
      for (let i = 0; i < PP_COUNT; i++) this.pp[i] = makeTile(ppSheet, i, 15);
    } else {
      const imgs = await Promise.all(Array.from({ length: PP_COUNT }, (_, i) => loadImage(ppPath(i))));
      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        if (!img) continue;
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        const cx = c.getContext('2d');
        cx.imageSmoothingEnabled = false;
        cx.drawImage(img, 1, 1, 16, 16, 0, 0, 16, 16);
        c.src = c.toDataURL('image/png');
        c.__bottom = contentBottom(c);
        this.pp[i] = c;
      }
    }
    onProgress(0.9);

    this.icons = {
      gold: toURL(P.coin),
      iron: toURL(P.iron),
      leather: toURL(P.leather),
      crystal: toURL(P.crystal),
      wood: toURL(P.wood),
      scale: toURL(P.scale),
      potion: toURL(P.potion),
      bow: toURL(bowCanvas),
      arrow: toURL(P.arrow),
      bone: toURL(P.bone),
    };
    this.iconImages = {};
    await Promise.all(Object.entries(this.icons).map(([key, url]) => new Promise((resolve) => {
      const im = new Image();
      im.onload = () => { this.iconImages[key] = im; resolve(); };
      im.onerror = () => resolve();
      im.src = url;
    })));
    onProgress(1);
    this.ready = true;
    return this;
  }

  tinyImg(i) {
    if (this.tiny[i]) return this.tiny[i];
    return null;
  }

  ppImg(i) {
    if (this.pp[i]) return this.pp[i];
    return null;
  }

  heroImg(heroId) {
    const map = { warrior: 87, mage: 84, archer: 85 };
    return this.tinyImg(map[heroId]);
  }

  iconURL(name) {
    return this.icons[name] || '';
  }

  materialIcon(id) {
    return this.icons[id] || this.icons.iron;
  }

  // resolve data-icon attributes in a DOM subtree
  hydrateIcons(root = document) {
    root.querySelectorAll('img[data-icon]').forEach(img => {
      const name = img.dataset.icon;
      if (!img.src && this.icons[name]) img.src = this.icons[name];
    });
  }
}

export const artIcons = P;

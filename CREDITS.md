# Emberfall — Credits & Licenses

Emberfall is a free, non-commercial game prototype. The code, level generation, UI, audio
synthesis, game design and writing were created for this project. The visual assets come
from the following free libraries; no paid or ripped assets are used.

---

## Art

### Tiny Dungeon 1.0 — Kenney

* Source: <https://kenney.nl/assets/tiny-dungeon>
* License: **Creative Commons Zero v1.0 Universal (CC0 1.0)**
* Used for: Warriors, mages, archers, goblins, orcs, ogres, bats, slimes, mummies, items,
  weapons, dungeon props, torches and treasure markers.
* License copy: [`assets/tiny-dungeon/License.txt`](assets/tiny-dungeon/License.txt)

### Pixel Platformer 1.2 — Kenney

* Source: <https://kenney.nl/assets/pixel-platformer>
* License: **Creative Commons Zero v1.0 Universal (CC0 1.0)**
* Used for: Terrain, grass, dirt, snow/ash ground, bridges, trees, clouds, crates, signs,
  chests, hearts and world effects. The 18×18 source tiles were cropped to a 16×16 core
  for the game atlas to fit Emberfall’s tile grid. Grass-cap variants were additionally
  rebuilt into seamless 16×16 tiles (their original 1px dark outlines removed) so terrain
  does not show a tile grid.
* License copy: [`assets/pixel-platformer/License.txt`](assets/pixel-platformer/License.txt)

### Dragons — Blarumyrran

* Source: <https://opengameart.org/content/dragons>
* License: **CC0 1.0** (the author asks for no attribution, but credit is gladly given)
* Used for: Vaelros, the Ashen Wyrm boss.
* License copy: [`assets/dragon/LICENSE.txt`](assets/dragon/LICENSE.txt)

Both Kenney packs are consistently among the highest-rated free game-asset libraries and
are released under CC0, which allows commercial use without attribution. Attribution is
provided here anyway because the artists deserve it.

---

## Fonts

### Cinzel

* Designer: Natanael Gama
* Source: <https://fonts.google.com/specimen/Cinzel>
* License: **SIL Open Font License 1.1**
* License copy: [`assets/fonts/OFL-Cinzel.txt`](assets/fonts/OFL-Cinzel.txt)

### Alegreya Sans

* Designer: Juan Pablo del Peral
* Source: <https://fonts.google.com/specimen/Alegreya+Sans>
* License: **SIL Open Font License 1.1**
* License copy: [`assets/fonts/OFL-AlegreyaSans.txt`](assets/fonts/OFL-AlegreyaSans.txt)

---

## Engine, code and audio

* Game engine, platformer physics, procedural level generation, boss state machine,
  responsive UI, save system, touch controls, and all gameplay code: original work for
  Emberfall.
* Music and sound effects: synthesized in real time with the Web Audio API. No recorded
  tracks, no external audio files.
* SVG icons (hearts, coins, locks, skill marks, etc.): original inline vector paths.
* Fonts are self-hosted, not fetched from Google at runtime.

---

## License summary

| Asset | Author | License |
|---|---|---|
| Tiny Dungeon | Kenney | CC0 1.0 |
| Pixel Platformer | Kenney | CC0 1.0 |
| Dragons | Blarumyrran | CC0 1.0 |
| Cinzel | Natanael Gama | OFL 1.1 |
| Alegreya Sans | Juan Pablo del Peral | OFL 1.1 |
| Emberfall code, UI, audio, writing | Emberfall project | original work |

CC0 1.0: <https://creativecommons.org/publicdomain/zero/1.0/>
OFL 1.1: <https://openfontlicense.org/>

If you reuse or redistribute this project, keep these credits and license files with it.

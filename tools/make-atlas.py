"""
Build the two sprite atlases used by Emberfall.

Run from the project root:
    python tools/make-atlas.py

Original Kenney tiles stay in assets/*/tiles/ so the atlases can be rebuilt.
Tiny Dungeon: 16x16 tiles, 12 columns.
Pixel Platformer: 18x18 source tiles, cropped to the 16x16 core, 15 columns.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"


def seamless_top(tile):
    """Remove Kenney's 1px dark outline from a grass cap and make it tileable."""
    core = tile.crop((2, 2, 16, 16)).resize((16, 16), Image.Resampling.NEAREST)
    draw = ImageDraw.Draw(core)
    draw.line([(0, 0), (15, 0)], fill=(43, 49, 64, 255))
    return core


def tiny_atlas():
    src = ASSETS / "tiny-dungeon" / "tiles"
    out = Image.new("RGBA", (12 * 16, 11 * 16), (0, 0, 0, 0))
    for i in range(132):
        tile = Image.open(src / f"tile_{i:04d}.png").convert("RGBA")
        out.alpha_composite(tile, ((i % 12) * 16, (i // 12) * 16))
    path = ASSETS / "tiny-dungeon" / "tiny-atlas.png"
    out.save(path, optimize=True)
    print("wrote", path, out.size)


def pixel_atlas():
    src = ASSETS / "pixel-platformer" / "tiles"
    out = Image.new("RGBA", (15 * 16, 12 * 16), (0, 0, 0, 0))
    for i in range(180):
        tile = Image.open(src / f"tile_{i:04d}.png").convert("RGBA")
        core = seamless_top(tile) if i in (0, 1, 2, 3) else tile.crop((1, 1, 17, 17))
        out.alpha_composite(core, ((i % 15) * 16, (i // 15) * 16))
    path = ASSETS / "pixel-platformer" / "pixel-atlas.png"
    out.save(path, optimize=True)
    print("wrote", path, out.size)



if __name__ == "__main__":
    tiny_atlas()
    pixel_atlas()

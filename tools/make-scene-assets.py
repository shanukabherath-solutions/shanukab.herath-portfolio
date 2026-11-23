"""
Builds the physics scene assets from the seven full-canvas layers in tools/scene-source/.

Each source layer is a 1584x396 PNG (the same canvas as Friends.png) holding one object at its original
position. This script
  1. trims ONLY the fully transparent padding (alpha == 0) of every layer, so no visible pixel changes,
  2. records each object's exact position in the original composition (manifest.json),
  3. checks that re-compositing the trimmed sprites reproduces Friends.png.

Run:  python3 tools/make-scene-assets.py     (needs Pillow + numpy)
"""
import json, os
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "scene-source")
OUT = os.path.join(HERE, "..", "src", "assets", "img", "scene")
REF = os.path.join(HERE, "Friends.original.png")
os.makedirs(OUT, exist_ok=True)

CANVAS = (1584, 396)
# Visible window of the canvas used as the interactive scene: the composition spans x 773..1407, so keep a
# little room either side. Relative positions between objects are exactly those of Friends.png.
WIN_X, WIN_W = 733, 714

# name -> source file, z (0 = back; verified against Friends.png), label, gravity factor
OBJECTS = [
    ("godot",  "6godot.png",  0, "Godot logo",                                  1.0),
    ("whale",  "5whale.png",  1, "Illustrated whale carrying blue containers",  1.0),
    ("dog",    "3dog.png",    2, "Illustrated dog",                             1.0),
    ("cat",    "4cat.png",    3, "Illustrated black cat",                       1.0),
    ("github", "2github.png", 4, "GitHub logo",                                 1.0),
    ("avatar", "avatar.png",  5, "Illustrated portrait of Shanuka B. Herath with arms crossed", 0.0),
    ("bee",    "1bee.png",    6, "Illustrated bee",                             0.12),
]

manifest = {"canvas": list(CANVAS), "window": {"x": WIN_X, "y": 0, "w": WIN_W, "h": CANVAS[1]}, "objects": []}
recomposed = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
for name, fn, z, label, gravity in sorted(OBJECTS, key=lambda o: o[2]):
    im = Image.open(os.path.join(SRC, fn)).convert("RGBA")
    assert im.size == CANVAS, (fn, im.size)
    l, t, r, b = im.split()[3].getbbox()             # bbox of alpha > 0: lossless trim
    sprite = im.crop((l, t, r, b))
    sprite.save(os.path.join(OUT, name + ".png"), optimize=True)
    recomposed.alpha_composite(sprite, (l, t))
    manifest["objects"].append({
        "name": name, "file": f"{name}.png", "x": l - WIN_X, "y": t, "w": r - l, "h": b - t,
        "z": z, "fixed": name == "avatar", "gravity": gravity, "label": label,
    })
    print(f"{name:7s} {r-l:4d}x{b-t:<4d} at canvas ({l},{t})  -> scene ({l-WIN_X},{t})  z={z}  {os.path.getsize(os.path.join(OUT, name + '.png'))//1024} KB")

json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=2)

# verification against the original composition (flattened on a solid colour so only visible pixels count)
def flat(img):
    return np.array(Image.alpha_composite(Image.new("RGBA", img.size, (255, 0, 255, 255)), img).convert("RGB")).astype(int)
ref = Image.open(REF).convert("RGBA")
d = np.abs(flat(recomposed) - flat(ref))
print(f"\nrecomposed vs Friends.png: max channel difference {d.max()} /255, differing pixels {(d.max(axis=2) > 1).sum()}")
assert d.max() <= 1, "recomposition does not match Friends.png"
print("OK: trimmed sprites placed at their recorded positions reproduce Friends.png")

#!/usr/bin/env python3
"""Split Codex sheets, flood-fill cream backgrounds, compress to webp."""
from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path("/workspace/merge-puzzle")
SRC = ROOT / "art-src"
OUT = ROOT / "public" / "assets"
OUT.mkdir(parents=True, exist_ok=True)

CREAM = (253, 242, 249)


def dist(a, b) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def flood_transparent(im: Image.Image, tol: int = 36, extra_seeds: list[tuple[int, int]] | None = None) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    pix = im.load()
    seen = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        if 0 <= x < w and 0 <= y < h and not seen[y][x] and dist(pix[x, y][:3], CREAM) <= tol:
            seen[y][x] = True
            q.append((x, y))

    for x in range(w):
        try_seed(x, 0)
        try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)
    if extra_seeds:
        for x, y in extra_seeds:
            try_seed(x, y)

    while q:
        x, y = q.popleft()
        r, g, b, _a = pix[x, y]
        pix[x, y] = (r, g, b, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and dist(pix[nx, ny][:3], CREAM) <= tol:
                seen[ny][nx] = True
                q.append((nx, ny))

    # Soft fringe only on pixels that touch transparency, so cream faces stay solid.
    changes = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a == 0:
                continue
            d = dist((r, g, b), CREAM)
            if d > tol + 24:
                continue
            edge = False
            for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1),(x-1,y-1),(x+1,y-1),(x-1,y+1),(x+1,y+1)):
                if not (0 <= nx < w and 0 <= ny < h) or pix[nx, ny][3] == 0:
                    edge = True
                    break
            if edge:
                fade = max(0, min(255, int(255 * (d - (tol - 8)) / 32)))
                changes.append((x, y, r, g, b, min(a, fade)))
    for x, y, r, g, b, a in changes:
        pix[x, y] = (r, g, b, a)
    return im


def bbox_opaque(im: Image.Image, pad: int = 8, min_alpha: int = 16) -> tuple[int, int, int, int]:
    alpha = im.split()[-1]
    box = alpha.getbbox()
    if box is None:
        return (0, 0, im.width, im.height)
    l, t, r, b = box
    # tighten to pixels above min_alpha
    pix = im.load()
    l2, t2, r2, b2 = r, b, l, t
    for y in range(t, b):
        for x in range(l, r):
            if pix[x, y][3] >= min_alpha:
                l2 = min(l2, x)
                t2 = min(t2, y)
                r2 = max(r2, x + 1)
                b2 = max(b2, y + 1)
    if r2 <= l2:
        l2, t2, r2, b2 = l, t, r, b
    l2 = max(0, l2 - pad)
    t2 = max(0, t2 - pad)
    r2 = min(im.width, r2 + pad)
    b2 = min(im.height, b2 + pad)
    return l2, t2, r2, b2


def square_crop(im: Image.Image, pad: int = 10) -> Image.Image:
    l, t, r, b = bbox_opaque(im, pad=pad)
    crop = im.crop((l, t, r, b))
    side = max(crop.width, crop.height)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2), crop)
    return canvas


def save_webp(im: Image.Image, path: Path, size: tuple[int, int] | None = None, quality: int = 82, lossless: bool = False) -> int:
    out = im
    if size:
        out = im.resize(size, Image.Resampling.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path, "WEBP", quality=quality, method=6, lossless=lossless)
    return path.stat().st_size


def split_grid(im: Image.Image, cols: int, rows: int, inset: float = 0.04) -> list[Image.Image]:
    w, h = im.size
    cw, ch = w / cols, h / rows
    dx, dy = cw * inset, ch * inset
    cells = []
    for row in range(rows):
        for col in range(cols):
            box = (
                int(col * cw + dx),
                int(row * ch + dy),
                int((col + 1) * cw - dx),
                int((row + 1) * ch - dy),
            )
            cells.append(im.crop(box))
    return cells


def make_hand() -> Image.Image:
    """Simple kawaii pointing hand matching the plum-outline sticker style."""
    im = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    outline = (89, 70, 91, 255)
    skin = (255, 224, 196, 255)
    sleeve = (255, 209, 168, 255)
    # sleeve
    d.rounded_rectangle((86, 150, 170, 250), 30, fill=sleeve, outline=outline, width=8)
    # palm
    d.ellipse((70, 70, 186, 196), fill=skin, outline=outline, width=8)
    # pointing finger up
    d.rounded_rectangle((108, 8, 148, 110), 20, fill=skin, outline=outline, width=8)
    # other fingers curled
    d.ellipse((150, 88, 198, 142), fill=skin, outline=outline, width=7)
    d.ellipse((54, 96, 100, 148), fill=skin, outline=outline, width=7)
    # highlight
    d.ellipse((96, 100, 124, 128), fill=(255, 255, 255, 140))
    return im


def slash_icon(im: Image.Image) -> Image.Image:
    out = im.copy()
    d = ImageDraw.Draw(out)
    # plum slash
    w, h = out.size
    d.line((int(w * 0.22), int(h * 0.78), int(w * 0.78), int(h * 0.22)), fill=(89, 70, 91, 255), width=max(8, w // 16))
    return out


def detect_map_nodes(path: Path) -> list[dict]:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    pix = im.load()
    # Path circles are pale peach ~ (250, 230, 210) with brown outline, on a winding tan path.
    # Detect fairly circular pale blobs.
    visited = [[False] * w for _ in range(h)]
    blobs = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if visited[y][x]:
                continue
            r, g, b = pix[x, y]
            # pale disk interior
            if not (r > 230 and g > 200 and b > 170 and r - g < 40 and r - b < 80 and g - b < 50 and (r + g + b) > 680):
                continue
            # flood
            q = deque([(x, y)])
            visited[y][x] = True
            pts = []
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for nx, ny in ((cx - 2, cy), (cx + 2, cy), (cx, cy - 2), (cx, cy + 2)):
                    if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                        nr, ng, nb = pix[nx, ny]
                        if nr > 230 and ng > 200 and nb > 170 and nr - ng < 40 and (nr + ng + nb) > 680:
                            visited[ny][nx] = True
                            q.append((nx, ny))
            if len(pts) < 40 or len(pts) > 8000:
                continue
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
            bw, bh = maxx - minx + 1, maxy - miny + 1
            if bw < 18 or bh < 18:
                continue
            ratio = bw / bh
            if ratio < 0.7 or ratio > 1.4:
                continue
            fill = len(pts) * 4 / (bw * bh)  # we sampled every 2px
            if fill < 0.35:
                continue
            blobs.append({
                "x": (minx + maxx) / 2 / w,
                "y": (miny + maxy) / 2 / h,
                "rw": bw / w,
                "rh": bh / h,
            })
    # sort from bottom to top (game path starts at bottom)
    blobs.sort(key=lambda n: (-n["y"], n["x"]))
    return blobs


def main() -> None:
    report: dict = {"files": {}}

    # --- flowers 4x2 ---
    flowers = Image.open(SRC / "01-flowers.png")
    cells = split_grid(flowers, 4, 2, inset=0.03)
    names = [f"flower-{i}" for i in range(1, 9)]
    for name, cell in zip(names, cells):
        cut = flood_transparent(cell, tol=38)
        token = square_crop(cut, pad=8)
        size = save_webp(token, OUT / f"{name}.webp", (192, 192), quality=84)
        report["files"][f"{name}.webp"] = size
        token.resize((192, 192), Image.Resampling.LANCZOS).save(SRC / "preview-cuts" / f"{name}.png")

    # --- icons 4x3 ---
    icons = Image.open(SRC / "02-icons.png")
    cells = split_grid(icons, 4, 3, inset=0.03)
    icon_names = [
        "stone", "stone-hp2", "vine", "star",
        "btn-undo", "btn-hammer", "btn-shuffle", "btn-sound",
        "btn-pause", "goal-make", "goal-clear", "goal-score",
    ]
    for idx, (name, cell) in enumerate(zip(icon_names, cells)):
        extra = None
        if name == "vine":
            # punch the inner cream hole so the wreath can wrap a flower
            extra = [(cell.width // 2, cell.height // 2)]
        cut = flood_transparent(cell, tol=38, extra_seeds=extra)
        token = square_crop(cut, pad=8)
        dim = 192 if name.startswith("btn") or name.startswith("goal") or name == "star" else 200
        size = save_webp(token, OUT / f"{name}.webp", (dim, dim), quality=84)
        report["files"][f"{name}.webp"] = size
        token.resize((192, 192), Image.Resampling.LANCZOS).save(SRC / "preview-cuts" / f"{name}.png")

    sound = Image.open(OUT / "btn-sound.webp").convert("RGBA")
    muted = slash_icon(sound)
    report["files"]["btn-sound-off.webp"] = save_webp(muted, OUT / "btn-sound-off.webp", quality=84)
    muted.save(SRC / "preview-cuts" / "btn-sound-off.png")

    # empty star (outline-ish): lower saturation / faded copy
    star = Image.open(OUT / "star.webp").convert("RGBA")
    faded = star.copy()
    pix = faded.load()
    for y in range(faded.height):
        for x in range(faded.width):
            r, g, b, a = pix[x, y]
            if a:
                # desaturate toward cream, keep outline
                grey = int(0.3 * r + 0.5 * g + 0.2 * b)
                pix[x, y] = (min(255, grey + 40), min(255, grey + 30), min(255, grey + 35), int(a * 0.7))
    report["files"]["star-empty.webp"] = save_webp(faded, OUT / "star-empty.webp", quality=84)

    # pointing hand
    (SRC / "preview-cuts").mkdir(parents=True, exist_ok=True)
    hand = make_hand()
    report["files"]["hand.webp"] = save_webp(hand, OUT / "hand.webp", (128, 128), quality=90)
    hand.save(SRC / "preview-cuts" / "hand.png")

    # --- background ---
    bg = Image.open(SRC / "03-background.png").convert("RGB")
    report["files"]["bg.webp"] = save_webp(bg, OUT / "bg.webp", (780, 1688), quality=76)

    # --- board frame, punch inside and outside ---
    frame = Image.open(SRC / "04-board-frame.png")
    punched = flood_transparent(frame, tol=32, extra_seeds=[(frame.width // 2, frame.height // 2)])
    # crop to opaque bbox, keep a little cream? no, transparent outside
    boxed = punched.crop(bbox_opaque(punched, pad=4))
    # scale so the frame can wrap the 700x900 board (BOARD is 40,560, 700x900)
    report["files"]["board-frame.webp"] = save_webp(boxed, OUT / "board-frame.webp", (780, 1040), quality=82)
    boxed.resize((390, 520), Image.Resampling.LANCZOS).save(SRC / "preview-cuts" / "board-frame.png")

    # --- world map, keep background ---
    mp = Image.open(SRC / "05-world-map.png").convert("RGB")
    report["files"]["map.webp"] = save_webp(mp, OUT / "map.webp", (780, 1170), quality=76)
    nodes = detect_map_nodes(SRC / "05-world-map.png")
    report["mapNodes"] = nodes
    report["mapNodeCount"] = len(nodes)
    Path(OUT / "map-nodes.json").write_text(json.dumps({"width": 780, "height": 1170, "nodes": nodes}, indent=2))

    # --- logo hero as menu art ---
    logo = Image.open(SRC / "06-logo-hero.png").convert("RGB")
    report["files"]["logo-hero.webp"] = save_webp(logo, OUT / "logo-hero.webp", (780, 1040), quality=78)

    # --- poses 2x2 ---
    poses = Image.open(SRC / "07-poses.png")
    cells = split_grid(poses, 2, 2, inset=0.03)
    pose_names = ["pose-clear", "pose-fail", "pose-daily", "pose-album"]
    for name, cell in zip(pose_names, cells):
        cut = flood_transparent(cell, tol=38)
        token = cut.crop(bbox_opaque(cut, pad=6))
        # fit into 480x360-ish without squashing
        tw, th = token.size
        scale = min(520 / tw, 400 / th)
        new = token.resize((int(tw * scale), int(th * scale)), Image.Resampling.LANCZOS)
        report["files"][f"{name}.webp"] = save_webp(new, OUT / f"{name}.webp", quality=82)
        new.save(SRC / "preview-cuts" / f"{name}.png")

    report["totalBytes"] = sum(report["files"].values())
    report["totalKB"] = round(report["totalBytes"] / 1024, 1)
    (SRC / "asset-sizes.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({k: report[k] for k in ("files", "totalKB", "mapNodeCount")}, indent=2))


if __name__ == "__main__":
    (SRC / "preview-cuts").mkdir(parents=True, exist_ok=True)
    main()

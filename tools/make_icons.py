#!/usr/bin/env python3
"""Generate the macaron flower icons and iOS startup images."""

import math
from pathlib import Path

from PIL import Image, ImageDraw


OUTPUT = Path('public/icons')
PALETTE = ['#ff8fab', '#70cda9', '#75c9f5', '#ffd1a8', '#b993f5']
BACKGROUND = '#fff6fb'


def flower(size: int) -> Image.Image:
    image = Image.new('RGBA', (size, size), BACKGROUND)
    draw = ImageDraw.Draw(image)
    padding = size * 0.08
    draw.rounded_rectangle(
        (padding, padding, size - padding, size - padding),
        radius=size * 0.22,
        fill='#ffdce8',
    )
    center = size / 2
    petal_distance = size * 0.19
    petal_radius = size * 0.16
    for index, color in enumerate(PALETTE):
        angle = 2 * math.pi * index / 5 - math.pi / 2
        x = center + math.cos(angle) * petal_distance
        y = center + math.sin(angle) * petal_distance
        draw.ellipse(
            (x - petal_radius, y - petal_radius, x + petal_radius, y + petal_radius),
            fill=color,
        )
    center_radius = size * 0.13
    draw.ellipse(
        (center - center_radius, center - center_radius,
         center + center_radius, center + center_radius),
        fill='#fff1a8',
    )
    eye_radius = size * 0.015
    for offset in (-size * 0.03, size * 0.03):
        draw.ellipse(
            (center + offset - eye_radius, center - size * 0.005 - eye_radius,
             center + offset + eye_radius, center - size * 0.005 + eye_radius),
            fill='#59465b',
        )
    return image


def splash(width: int, height: int) -> Image.Image:
    image = Image.new('RGBA', (width, height), BACKGROUND)
    size = int(min(width, height) * 0.42)
    icon = flower(size)
    image.alpha_composite(icon, ((width - size) // 2, (height - size) // 2))
    return image


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for size in (180, 192, 512):
        flower(size).save(OUTPUT / f'icon-{size}.png')
    for size in (192, 512):
        flower(size).save(OUTPUT / f'maskable-{size}.png')
    flower(32).save(OUTPUT / 'favicon-32.png')
    flower(512).save(OUTPUT / 'splash-512.png')
    for width, height in ((1170, 2532), (1290, 2796), (750, 1334)):
        splash(width, height).save(OUTPUT / f'splash-{width}x{height}.png')
    svg_petals = ''.join(
        f'<ellipse cx="256" cy="154" rx="71" ry="104" fill="{color}" '
        f'transform="rotate({index * 72} 256 256)"/>'
        for index, color in enumerate(PALETTE)
    )
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        f'<rect width="512" height="512" rx="112" fill="{BACKGROUND}"/>'
        f'{svg_petals}<circle cx="256" cy="256" r="67" fill="#fff1a8"/>'
        '<circle cx="240" cy="250" r="6" fill="#59465b"/>'
        '<circle cx="272" cy="250" r="6" fill="#59465b"/></svg>'
    )
    (OUTPUT / 'icon.svg').write_text(svg, encoding='utf-8')


if __name__ == '__main__':
    main()

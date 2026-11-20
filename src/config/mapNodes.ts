/** Map art is shipped at 1.5x (map-tall.webp = 1170x1755 + 150px reflected ground pad). */
export const MAP_SIZE = { width: 1170, height: 1755, pad: 150 } as const;
export const MAP_NODES: Array<{ x: number; y: number }> = [
  { x: 0.2744, y: 0.9521 },
  { x: 0.2128, y: 0.8803 },
  { x: 0.3551, y: 0.8573 },
  { x: 0.4974, y: 0.8547 },
  { x: 0.6397, y: 0.8496 },
  { x: 0.7782, y: 0.8342 },
  { x: 0.7897, y: 0.7624 },
  { x: 0.659, y: 0.7393 },
  { x: 0.5167, y: 0.7137 },
  { x: 0.3897, y: 0.7009 },
  { x: 0.2551, y: 0.6803 },
  { x: 0.2551, y: 0.6085 },
  { x: 0.3667, y: 0.5675 },
  { x: 0.5167, y: 0.565 },
  { x: 0.6551, y: 0.5624 },
  { x: 0.7974, y: 0.5368 },
  { x: 0.609, y: 0.4598 },
  { x: 0.4667, y: 0.4496 },
  { x: 0.3321, y: 0.4368 },
  { x: 0.209, y: 0.406 },
  { x: 0.2359, y: 0.3316 },
  { x: 0.3667, y: 0.3137 },
  { x: 0.5013, y: 0.306 },
  { x: 0.6397, y: 0.3009 },
  { x: 0.7705, y: 0.2778 },
  { x: 0.7205, y: 0.2111 },
  { x: 0.5859, y: 0.2085 },
  { x: 0.4474, y: 0.2137 },
  { x: 0.4397, y: 0.1188 },
  { x: 0.5513, y: 0.088 },
];

/** Gift chests (every 5th level, shown after the boss node) on baked path circles, as map fractions. */
export const MAP_GIFTS: Record<number, { x: number; y: number }> = {
  5: { x: 0.4308, y: 0.9607 },
  10: { x: 0.7487, y: 0.4701 },
  15: { x: 0.8564, y: 0.3778 },
  20: { x: 0.3154, y: 0.2000 },
  25: { x: 0.6513, y: 0.0547 },
  30: { x: 0.3103, y: 0.0940 },
};

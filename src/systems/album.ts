export const FLOWER_LEVELS = 8;

export function discoverFlowers(discoveries: boolean[], created: number[]): boolean[] {
  const result = Array.from({ length: FLOWER_LEVELS }, (_, index) =>
    Boolean(discoveries[index]));
  for (const level of created) {
    if (level >= 1 && level <= FLOWER_LEVELS) result[level - 1] = true;
  }
  return result;
}

export function hasRainbowGarden(discoveries: boolean[]): boolean {
  return Array.from({ length: FLOWER_LEVELS }, (_, index) => discoveries[index] === true)
    .every(Boolean);
}

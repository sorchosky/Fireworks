// Size of one "art pixel" in CSS pixels. Every layer (sky, skyline,
// fireworks, grain) renders on this shared grid so the scene reads as one
// piece of pixel art.
export const PIXEL = 3

// 4x4 Bayer matrix, normalized to (0, 1), for ordered dithering.
const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

export function bayer(x: number, y: number): number {
  return (BAYER_4[(y & 3) * 4 + (x & 3)] + 0.5) / 16
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Kid-friendly hues spread around the wheel, avoiding muddy tones.
const HUES = [0, 25, 45, 95, 140, 175, 200, 220, 265, 300, 330, 350]

export function randomHue(): number {
  const base = HUES[Math.floor(Math.random() * HUES.length)]
  return base + (Math.random() * 16 - 8)
}

export function randomHueFar(fromHue: number): number {
  let hue = randomHue()
  let tries = 0
  while (Math.abs(((hue - fromHue + 540) % 360) - 180) < 60 && tries < 8) {
    hue = randomHue()
    tries++
  }
  return hue
}

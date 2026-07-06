export type BurstType = 'peony' | 'willow' | 'shimmer' | 'colorShift' | 'ring' | 'crackle'

export interface Particle {
  x: number
  y: number
  prevX: number
  prevY: number
  vx: number
  vy: number
  gravity: number
  drag: number
  hue: number
  hue2?: number
  size: number
  life: number
  maxLife: number
  flicker: boolean
  trail: boolean
  sparkle: boolean
}

export interface Rocket {
  x: number
  y: number
  startY: number
  targetY: number
  vx: number
  vy: number
  hue: number
  trail: { x: number; y: number; alpha: number }[]
  burstType: BurstType
  spawnedAt: number
}

export interface Firework {
  rocket: Rocket | null
  particles: Particle[]
}

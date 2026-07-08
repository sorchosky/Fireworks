import type { BurstType, Particle, Rocket } from './types'
import { randomHue, randomHueFar } from './palette'

const MAX_PARTICLES = 900
const MAX_ROCKETS = 8
const CIRCLE_BURST_TYPES: BurstType[] = ['peony', 'willow', 'shimmer', 'colorShift', 'ring', 'crackle']
const SHAPE_BURST_TYPES: BurstType[] = ['heart', 'square', 'star']
// Most fireworks stay round; shapes pop up only now and then.
const SHAPE_BURST_CHANCE = 0.12

function pickBurstType(): BurstType {
  if (Math.random() < SHAPE_BURST_CHANCE) {
    return SHAPE_BURST_TYPES[Math.floor(Math.random() * SHAPE_BURST_TYPES.length)]
  }
  return CIRCLE_BURST_TYPES[Math.floor(Math.random() * CIRCLE_BURST_TYPES.length)]
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function hueDelta(from: number, to: number): number {
  let d = ((to - from + 540) % 360) - 180
  return d
}

interface Point {
  x: number
  y: number
}

// Outline points for shaped bursts, in unit space centered on the origin.
// Particles launch toward each point so the burst briefly traces the shape
// before gravity and drag take over.

function heartOutline(count: number): Point[] {
  const raw: Point[] = []
  let maxR = 0
  for (let i = 0; i < count; i++) {
    const t = (Math.PI * 2 * i) / count
    const x = 16 * Math.pow(Math.sin(t), 3)
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    raw.push({ x, y })
    maxR = Math.max(maxR, Math.hypot(x, y))
  }
  return raw.map((p) => ({ x: p.x / maxR, y: p.y / maxR }))
}

function squareOutline(count: number): Point[] {
  const pts: Point[] = []
  for (let i = 0; i < count; i++) {
    const t = i / count
    const side = Math.floor(t * 4)
    const local = (t * 4) % 1
    switch (side) {
      case 0:
        pts.push({ x: -1 + 2 * local, y: -1 })
        break
      case 1:
        pts.push({ x: 1, y: -1 + 2 * local })
        break
      case 2:
        pts.push({ x: 1 - 2 * local, y: 1 })
        break
      default:
        pts.push({ x: -1, y: 1 - 2 * local })
        break
    }
  }
  return pts
}

function starOutline(count: number): Point[] {
  const spikes = 5
  const outerR = 1
  const innerR = 0.45
  const totalVerts = spikes * 2
  const pts: Point[] = []
  for (let i = 0; i < count; i++) {
    const segFloat = (i / count) * totalVerts
    const segIndex = Math.floor(segFloat) % totalVerts
    const segFrac = segFloat - Math.floor(segFloat)
    const r0 = segIndex % 2 === 0 ? outerR : innerR
    const r1 = (segIndex + 1) % 2 === 0 ? outerR : innerR
    const a0 = -Math.PI / 2 + (segIndex / totalVerts) * Math.PI * 2
    const a1 = -Math.PI / 2 + ((segIndex + 1) / totalVerts) * Math.PI * 2
    const r = lerp(r0, r1, segFrac)
    const a = lerp(a0, a1, segFrac)
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r })
  }
  return pts
}

export type BurstListener = (x: number, y: number, type: BurstType) => void

export class FireworksEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private rockets: Rocket[] = []
  private particles: Particle[] = []
  private width = 0
  private height = 0
  private dpr = 1
  private onBurst: BurstListener | null = null
  private groundY = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D context unavailable')
    this.ctx = ctx
  }

  setBurstListener(fn: BurstListener | null) {
    this.onBurst = fn
  }

  resize(cssWidth: number, cssHeight: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.width = cssWidth
    this.height = cssHeight
    this.canvas.width = Math.round(cssWidth * this.dpr)
    this.canvas.height = Math.round(cssHeight * this.dpr)
    this.canvas.style.width = `${cssWidth}px`
    this.canvas.style.height = `${cssHeight}px`
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    // Rockets launch from just above the (approximate) skyline base.
    this.groundY = cssHeight * 0.98
  }

  spawnRocket(tapX: number, tapY: number) {
    if (this.rockets.length >= MAX_ROCKETS) return

    const startX = Math.max(20, Math.min(this.width - 20, tapX + (Math.random() * 40 - 20)))
    const minTarget = this.height * 0.14
    const maxTarget = this.height * 0.55
    let targetY = lerp(minTarget, maxTarget, Math.random())
    // Bias toward the tap point when it lands within a sane burst band.
    if (tapY > minTarget && tapY < maxTarget) {
      targetY = lerp(targetY, tapY, 0.5)
    }
    targetY = Math.max(minTarget, Math.min(maxTarget, targetY))

    const distance = this.groundY - targetY
    const duration = lerp(0.85, 1.3, Math.random())
    const v0 = (2 * distance) / duration
    const gravity = v0 / duration

    const rocket: Rocket = {
      x: startX,
      y: this.groundY,
      startY: this.groundY,
      targetY,
      vx: Math.random() * 30 - 15,
      vy: -v0,
      hue: randomHue(),
      trail: [],
      burstType: pickBurstType(),
      spawnedAt: performance.now(),
    }
    // Stash gravity/duration via closure-free approach: recompute on the fly using vy sign.
    ;(rocket as Rocket & { gravity: number }).gravity = gravity
    this.rockets.push(rocket)
  }

  private burst(cx: number, cy: number, type: BurstType, baseHue: number) {
    const created: Particle[] = []
    const hue2 = randomHueFar(baseHue)

    const push = (p: Partial<Particle> & Pick<Particle, 'x' | 'y' | 'vx' | 'vy'>) => {
      created.push({
        x: p.x,
        y: p.y,
        prevX: p.x,
        prevY: p.y,
        vx: p.vx,
        vy: p.vy,
        gravity: p.gravity ?? 140,
        drag: p.drag ?? 0.6,
        hue: p.hue ?? baseHue,
        hue2: p.hue2,
        size: p.size ?? 2.2,
        life: 0,
        maxLife: p.maxLife ?? 1,
        flicker: p.flicker ?? false,
        trail: p.trail ?? false,
        sparkle: p.sparkle ?? false,
      })
    }

    switch (type) {
      case 'peony': {
        const count = Math.round(lerp(60, 85, Math.random()))
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + Math.random() * 0.15
          const speed = lerp(90, 210, Math.random())
          push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            gravity: 160,
            drag: 0.55,
            maxLife: lerp(0.8, 1.15, Math.random()),
            size: lerp(1.8, 3, Math.random()),
            flicker: Math.random() < 0.3,
          })
        }
        break
      }
      case 'willow': {
        const count = Math.round(lerp(45, 65, Math.random()))
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3
          const speed = lerp(50, 110, Math.random())
          push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            gravity: 210,
            drag: 0.25,
            maxLife: lerp(1.9, 2.7, Math.random()),
            size: lerp(1.4, 2.2, Math.random()),
            flicker: true,
            trail: true,
          })
        }
        break
      }
      case 'shimmer': {
        const count = Math.round(lerp(90, 130, Math.random()))
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2
          const speed = lerp(10, 55, Math.random())
          push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            gravity: 60,
            drag: 1.1,
            maxLife: lerp(0.5, 0.85, Math.random()),
            size: lerp(1.2, 2.1, Math.random()),
            flicker: true,
          })
        }
        break
      }
      case 'colorShift': {
        const count = Math.round(lerp(65, 90, Math.random()))
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + Math.random() * 0.15
          const speed = lerp(80, 180, Math.random())
          push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            gravity: 150,
            drag: 0.5,
            maxLife: lerp(1.1, 1.5, Math.random()),
            size: lerp(1.8, 2.8, Math.random()),
            flicker: Math.random() < 0.25,
            hue: baseHue,
            hue2,
          })
        }
        break
      }
      case 'ring': {
        const count = Math.round(lerp(55, 75, Math.random()))
        const speed = lerp(120, 170, Math.random())
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count
          const jitter = speed * (1 + (Math.random() * 0.06 - 0.03))
          push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * jitter,
            vy: Math.sin(angle) * jitter * 0.85,
            gravity: 130,
            drag: 0.5,
            maxLife: lerp(0.9, 1.1, Math.random()),
            size: lerp(1.8, 2.6, Math.random()),
          })
        }
        break
      }
      case 'crackle': {
        const count = Math.round(lerp(55, 80, Math.random()))
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2
          const speed = lerp(70, 160, Math.random())
          push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            gravity: 170,
            drag: 0.5,
            maxLife: lerp(0.9, 1.3, Math.random()),
            size: lerp(1.6, 2.4, Math.random()),
            sparkle: true,
          })
        }
        break
      }
      case 'heart': {
        const count = Math.round(lerp(70, 100, Math.random()))
        const speed = lerp(110, 150, Math.random())
        for (const pt of heartOutline(count)) {
          push({
            x: cx,
            y: cy,
            vx: pt.x * speed,
            vy: pt.y * speed,
            gravity: 130,
            drag: 0.45,
            maxLife: lerp(1.0, 1.3, Math.random()),
            size: lerp(1.8, 2.6, Math.random()),
            flicker: Math.random() < 0.2,
          })
        }
        break
      }
      case 'square': {
        const count = Math.round(lerp(64, 88, Math.random()))
        const speed = lerp(85, 115, Math.random())
        for (const pt of squareOutline(count)) {
          push({
            x: cx,
            y: cy,
            vx: pt.x * speed,
            vy: pt.y * speed,
            gravity: 130,
            drag: 0.45,
            maxLife: lerp(1.0, 1.3, Math.random()),
            size: lerp(1.8, 2.6, Math.random()),
            flicker: Math.random() < 0.2,
          })
        }
        break
      }
      case 'star': {
        const count = Math.round(lerp(70, 95, Math.random()))
        const speed = lerp(110, 150, Math.random())
        for (const pt of starOutline(count)) {
          push({
            x: cx,
            y: cy,
            vx: pt.x * speed,
            vy: pt.y * speed,
            gravity: 130,
            drag: 0.45,
            maxLife: lerp(1.0, 1.3, Math.random()),
            size: lerp(1.8, 2.6, Math.random()),
            flicker: Math.random() < 0.2,
          })
        }
        break
      }
    }

    if (this.particles.length + created.length > MAX_PARTICLES) {
      const overflow = this.particles.length + created.length - MAX_PARTICLES
      this.particles.splice(0, Math.max(0, overflow))
    }
    this.particles.push(...created)
    this.onBurst?.(cx, cy, type)
  }

  update(dt: number) {
    // Rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i] as Rocket & { gravity: number }
      r.trail.push({ x: r.x, y: r.y, alpha: 1 })
      if (r.trail.length > 12) r.trail.shift()
      for (const t of r.trail) t.alpha *= 0.88

      r.vy += r.gravity * dt
      r.x += r.vx * dt
      r.y += r.vy * dt

      if (r.vy >= 0 || r.y <= r.targetY) {
        this.burst(r.x, r.y, r.burstType, r.hue)
        this.rockets.splice(i, 1)
      }
    }

    // Particles
    const spawned: Particle[] = []
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life += dt
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1)
        continue
      }
      p.prevX = p.x
      p.prevY = p.y
      p.vy += p.gravity * dt
      const dragFactor = Math.max(0, 1 - p.drag * dt)
      p.vx *= dragFactor
      p.vy *= dragFactor
      p.x += p.vx * dt
      p.y += p.vy * dt

      if (p.sparkle) {
        const progress = p.life / p.maxLife
        if (progress > 0.25 && progress < 0.8 && Math.random() < 0.06 && this.particles.length + spawned.length < MAX_PARTICLES) {
          spawned.push({
            x: p.x,
            y: p.y,
            prevX: p.x,
            prevY: p.y,
            vx: (Math.random() - 0.5) * 40,
            vy: (Math.random() - 0.5) * 40,
            gravity: 60,
            drag: 1.4,
            hue: p.hue,
            size: 1.1,
            life: 0,
            maxLife: lerp(0.15, 0.3, Math.random()),
            flicker: true,
            trail: false,
            sparkle: false,
          })
        }
      }
    }
    if (spawned.length) this.particles.push(...spawned)
  }

  draw() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.globalCompositeOperation = 'lighter'

    // Rocket trails + tips
    for (const r of this.rockets) {
      for (let i = 1; i < r.trail.length; i++) {
        const a = r.trail[i - 1]
        const b = r.trail[i]
        ctx.strokeStyle = `hsla(${r.hue}, 90%, 70%, ${b.alpha * 0.6})`
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
      ctx.fillStyle = `hsla(${r.hue}, 90%, 85%, 0.9)`
      ctx.beginPath()
      ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }

    // Particles
    for (const p of this.particles) {
      const progress = p.life / p.maxLife
      const fade = 1 - progress * progress
      let hue = p.hue
      if (p.hue2 !== undefined) {
        hue = p.hue + hueDelta(p.hue, p.hue2) * progress
      }
      let alpha = fade
      if (p.flicker) {
        alpha *= 0.55 + Math.random() * 0.45
      }
      if (alpha <= 0.02) continue

      if (p.trail) {
        ctx.strokeStyle = `hsla(${hue}, 95%, 65%, ${alpha})`
        ctx.lineWidth = p.size
        ctx.beginPath()
        ctx.moveTo(p.prevX, p.prevY)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      } else {
        ctx.fillStyle = `hsla(${hue}, 95%, 68%, ${alpha * 0.35})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = `hsla(${hue}, 100%, 82%, ${alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  get particleCount() {
    return this.particles.length
  }
}

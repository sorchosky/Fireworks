import { useEffect, useMemo, useRef } from 'react'
import { PIXEL } from '../engine/pixel'

interface Window {
  x: number
  y: number
  w: number
  h: number
  shape: 'rect' | 'square' | 'arch'
  opacity: number
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

type Roof = 'gable' | 'flat' | 'slant' | 'spire'

interface Building {
  x: number
  width: number
  wallHeight: number
  roofHeight: number
  roof: Roof
  shade: string
  windows: Window[]
  // Extra solid blocks drawn in the building shade: setbacks, cornices,
  // chimneys, rooftop boxes, water towers, antennas.
  parts: Rect[]
  // Triangles in the building shade: dormer and water-tower roofs.
  peaks: { left: number; right: number; baseY: number; apexX: number; apexY: number }[]
}

const VIEW_WIDTH = 3000
const VIEW_HEIGHT = 180
const BACK_SHADES = ['#1a2440', '#1d2846']
const FRONT_SHADES = ['#0a0e1c', '#0d1226', '#101632']
const WARM = '#ffcf8a'
// Towers stay well below the lowest burst height so they frame the show
// without hiding it.
const MAX_TOWER = 165

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function snap(v: number): number {
  return Math.round(v / PIXEL) * PIXEL
}

// Loose grid of house-style windows for low and mid-rise buildings.
function makeWindows(x: number, width: number, wallTop: number, wallHeight: number): Window[] {
  const windows: Window[] = []
  const cols = Math.max(1, Math.floor(width / 10))
  const rows = Math.max(1, Math.floor(wallHeight / 14))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() < 0.32) {
        const roll = Math.random()
        const shape: Window['shape'] = roll < 0.12 ? 'arch' : roll < 0.3 ? 'square' : 'rect'
        windows.push({
          x: x + 3 + c * (width / cols),
          y: wallTop + 4 + r * (wallHeight / rows),
          w: width / cols - 4,
          h: wallHeight / rows - 6,
          shape,
          opacity: 0.5 + Math.random() * 0.45,
        })
      }
    }
  }
  return windows
}

// Dense one-pixel office windows. Each floor gets its own occupancy so
// lit windows cluster into bands like a real tower at night.
function makeTowerWindows(x: number, width: number, top: number, bottom: number): Window[] {
  const windows: Window[] = []
  const pitch = PIXEL * 2
  for (let y = snap(top + pitch); y < bottom - PIXEL; y += pitch) {
    const floorRate = Math.random() < 0.2 ? rand(0.4, 0.7) : rand(0.03, 0.25)
    for (let wx = snap(x + pitch * 0.75); wx < x + width - pitch * 0.75; wx += pitch) {
      if (Math.random() < floorRate) {
        windows.push({ x: wx, y, w: PIXEL, h: PIXEL, shape: 'rect', opacity: rand(0.35, 0.85) })
      }
    }
  }
  return windows
}

function makeTower(x: number, shade: string): Building {
  const width = rand(24, 54)
  const tall = Math.random() < 0.3
  const wallHeight = tall ? rand(115, MAX_TOWER - 30) : rand(60, 115)
  const wallTop = VIEW_HEIGHT - wallHeight
  const parts: Rect[] = []
  const peaks: Building['peaks'] = []
  const roll = Math.random()
  const roof: Roof = roll < 0.55 ? 'flat' : roll < 0.75 ? 'slant' : 'spire'
  let roofHeight = 0
  let crownTop = wallTop

  if (roof === 'flat') {
    // Up to two setbacks, each narrower than the one below.
    let w = width
    let top = wallTop
    const steps = Math.random() < 0.6 ? Math.floor(rand(1, 3)) : 0
    for (let i = 0; i < steps && w > 14; i++) {
      w *= rand(0.55, 0.75)
      const h = rand(8, 18)
      top -= h
      parts.push({ x: x + (width - w) / 2, y: top, w, h })
    }
    crownTop = top
    if (Math.random() < 0.6) {
      const ax = x + width / 2 + (Math.random() < 0.5 ? 0 : rand(-w / 3, w / 3))
      const ah = rand(10, 24)
      parts.push({ x: ax, y: top - ah, w: 2, h: ah })
    }
  } else if (roof === 'slant') {
    roofHeight = rand(12, 26)
  } else {
    // Stepped crown that narrows into a needle.
    let w = width * 0.7
    let top = wallTop
    for (let i = 0; i < 3; i++) {
      const h = rand(5, 9)
      top -= h
      parts.push({ x: x + (width - w) / 2, y: top, w, h })
      w *= 0.6
    }
    const ah = rand(16, 28)
    parts.push({ x: x + width / 2 - 1, y: top - ah, w: 2, h: ah })
    crownTop = top
  }

  // Keep every tower, antenna included, under the height cap.
  const overshoot = VIEW_HEIGHT - MAX_TOWER - Math.min(crownTop - roofHeight, ...parts.map((p) => p.y))
  if (overshoot > 0) {
    for (const p of parts) {
      p.y += overshoot
      if (p.w <= 2) p.h -= overshoot
    }
  }

  return {
    x,
    width,
    wallHeight,
    roofHeight,
    roof,
    shade,
    windows: makeTowerWindows(x, width, wallTop, VIEW_HEIGHT),
    parts: parts.filter((p) => p.h > 0),
    peaks,
  }
}

function makeMidRise(x: number, shade: string): Building {
  const gable = Math.random() < 0.2
  const width = gable ? rand(22, 40) : rand(28, 64)
  const wallHeight = gable ? rand(22, 44) : rand(30, 78)
  const wallTop = VIEW_HEIGHT - wallHeight
  const parts: Rect[] = []
  const peaks: Building['peaks'] = []

  if (gable) {
    const roofHeight = rand(10, 20)
    if (Math.random() < 0.4) {
      parts.push({ x: x + width * rand(0.55, 0.75), y: wallTop - roofHeight * 1.2, w: 3, h: roofHeight })
    }
    return {
      x,
      width,
      wallHeight,
      roofHeight,
      roof: 'gable',
      shade,
      windows: makeWindows(x, width, wallTop, wallHeight),
      parts,
      peaks,
    }
  }

  // Cornice ledge overhanging the flat roof.
  parts.push({ x: x - 1.5, y: wallTop - 3, w: width + 3, h: 3 })
  const extra = Math.random()
  if (extra < 0.22) {
    // Water tower: tank on stilts with a pointed cap.
    const tx = x + width * rand(0.2, 0.6)
    const tw = 12
    const legH = 5
    const tankH = 10
    parts.push({ x: tx + 1, y: wallTop - 3 - legH, w: 2, h: legH })
    parts.push({ x: tx + tw - 3, y: wallTop - 3 - legH, w: 2, h: legH })
    parts.push({ x: tx, y: wallTop - 3 - legH - tankH, w: tw, h: tankH })
    const capBase = wallTop - 3 - legH - tankH
    peaks.push({ left: tx - 1, right: tx + tw + 1, baseY: capBase, apexX: tx + tw / 2, apexY: capBase - 5 })
  } else if (extra < 0.5) {
    // Rooftop mechanical box.
    const bw = width * rand(0.2, 0.4)
    const bh = rand(5, 10)
    parts.push({ x: x + width * rand(0.1, 0.5), y: wallTop - 3 - bh, w: bw, h: bh })
  }

  return {
    x,
    width,
    wallHeight,
    roofHeight: 0,
    roof: 'flat',
    shade,
    windows: makeWindows(x, width, wallTop, wallHeight),
    parts,
    peaks,
  }
}

function makeRow(make: (x: number, shade: string) => Building, shades: string[], minGap: number, maxGap: number) {
  const buildings: Building[] = []
  let x = -20
  while (x < VIEW_WIDTH + 20) {
    const b = make(x, pick(shades))
    buildings.push(b)
    x += b.width + rand(minGap, maxGap)
  }
  return buildings
}

function makeSkyline() {
  const back = makeRow(makeTower, BACK_SHADES, -6, 4)
  const front = makeRow(makeMidRise, FRONT_SHADES, -3, -1)
  return { back, front }
}

type Span = [number, number] | null

const COLS = Math.ceil(VIEW_WIDTH / PIXEL)
const ROWS = Math.round(VIEW_HEIGHT / PIXEL)

// Scanline fill on the art-pixel grid. `span` returns the horizontal extent
// (in view units) of the shape at a given y, so slopes and curves come out
// stair-stepped instead of anti-aliased.
function fillRows(ctx: CanvasRenderingContext2D, top: number, bottom: number, span: (y: number) => Span) {
  const r0 = Math.round(top / PIXEL)
  const r1 = Math.max(r0 + 1, Math.round(bottom / PIXEL))
  for (let r = r0; r < r1; r++) {
    const y = Math.min(bottom, Math.max(top, (r + 0.5) * PIXEL))
    const s = span(y)
    if (!s) continue
    const c0 = Math.round(s[0] / PIXEL)
    const c1 = Math.max(c0 + 1, Math.round(s[1] / PIXEL))
    ctx.fillRect(c0, r, c1 - c0, 1)
  }
}

function fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  fillRows(ctx, y, y + h, () => [x, x + w])
}

function fillTriangle(ctx: CanvasRenderingContext2D, left: number, right: number, baseY: number, apexX: number, apexY: number) {
  fillRows(ctx, apexY, baseY, (y) => {
    const t = (y - apexY) / (baseY - apexY)
    return [lerp(apexX, left, t), lerp(apexX, right, t)]
  })
}

function fillHalfEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  fillRows(ctx, cy - ry, cy, (y) => {
    const dy = (cy - y) / ry
    const hw = rx * Math.sqrt(Math.max(0, 1 - dy * dy))
    return hw > 0 ? [cx - hw, cx + hw] : null
  })
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building) {
  const wallTop = VIEW_HEIGHT - b.wallHeight

  ctx.globalAlpha = 1
  ctx.fillStyle = b.shade
  fillRect(ctx, b.x, wallTop, b.width, b.wallHeight)
  if (b.roof === 'gable') {
    fillTriangle(ctx, b.x - 1.5, b.x + b.width + 1.5, wallTop, b.x + b.width / 2, wallTop - b.roofHeight)
  } else if (b.roof === 'slant') {
    // One-sided wedge: full height on the left, sloping down to the right.
    fillRows(ctx, wallTop - b.roofHeight, wallTop, (y) => {
      const t = (y - (wallTop - b.roofHeight)) / b.roofHeight
      return [b.x, b.x + b.width * Math.max(0.08, t)]
    })
  }
  for (const p of b.parts) fillRect(ctx, p.x, p.y, p.w, p.h)
  for (const k of b.peaks) fillTriangle(ctx, k.left, k.right, k.baseY, k.apexX, k.apexY)

  ctx.fillStyle = WARM
  for (const w of b.windows) {
    ctx.globalAlpha = w.opacity
    if (w.shape === 'arch') {
      fillRect(ctx, w.x, w.y + w.h * 0.35, w.w, w.h * 0.65)
      fillHalfEllipse(ctx, w.x + w.w / 2, w.y + w.h * 0.35, w.w / 2, w.h * 0.35)
    } else if (w.shape === 'square') {
      const size = Math.min(w.w, w.h)
      fillRect(ctx, w.x, w.y, size, size)
    } else {
      fillRect(ctx, w.x, w.y, w.w, w.h)
    }
  }
  ctx.globalAlpha = 1
}

export default function CitySkyline() {
  const { back, front } = useMemo(makeSkyline, [])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, COLS, ROWS)
    for (const b of back) drawBuilding(ctx, b)
    for (const b of front) drawBuilding(ctx, b)
  }, [back, front])

  return (
    <div className="city-skyline" aria-hidden="true">
      <canvas
        ref={canvasRef}
        width={COLS}
        height={ROWS}
        style={{ width: COLS * PIXEL, height: ROWS * PIXEL }}
      />
    </div>
  )
}

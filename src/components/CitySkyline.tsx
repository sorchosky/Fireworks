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

interface Chimney {
  x: number
  width: number
  height: number
}

interface Dormer {
  x: number
  width: number
  roofHeight: number
  wallHeight: number
}

interface Building {
  x: number
  width: number
  wallHeight: number
  roofHeight: number
  shade: string
  windows: Window[]
  chimney: Chimney | null
  dormer: Dormer | null
}

const VIEW_WIDTH = 3000
const VIEW_HEIGHT = 130
const BACK_SHADES = ['#1a2440', '#1d2846']
const FRONT_SHADES = ['#0a0e1c', '#0d1226', '#101632']
const WARM = '#ffcf8a'

function makeWindows(x: number, width: number, wallTop: number, wallHeight: number): Window[] {
  const windows: Window[] = []
  const cols = Math.max(1, Math.floor(width / 10))
  const rows = Math.max(1, Math.floor(wallHeight / 14))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() < 0.32) {
        const roll = Math.random()
        const shape: Window['shape'] = roll < 0.15 ? 'arch' : roll < 0.3 ? 'square' : 'rect'
        const w = width / cols - 4
        const h = wallHeight / rows - 6
        windows.push({
          x: x + 3 + c * (width / cols),
          y: wallTop + 4 + r * (wallHeight / rows),
          w,
          h,
          shape,
          opacity: 0.5 + Math.random() * 0.45,
        })
      }
    }
  }
  return windows
}

function makeRow(startX: number, endX: number, shades: string[], scale: number): Building[] {
  const buildings: Building[] = []
  let x = startX
  while (x < endX) {
    const width = (22 + Math.random() * 30) * scale
    const wallHeight = (18 + Math.random() * 34) * scale
    const roofHeight = (10 + Math.random() * 22) * scale
    const shade = shades[Math.floor(Math.random() * shades.length)]
    const wallTop = VIEW_HEIGHT - wallHeight

    const windows = makeWindows(x, width, wallTop, wallHeight)

    let chimney: Chimney | null = null
    if (scale > 0.9 && Math.random() < 0.4) {
      chimney = {
        x: x + width * (0.55 + Math.random() * 0.2),
        width: width * 0.09,
        height: roofHeight * (0.9 + Math.random() * 0.6),
      }
    }

    let dormer: Dormer | null = null
    if (scale > 0.9 && width > 30 && Math.random() < 0.35) {
      const dormerWidth = width * 0.32
      dormer = {
        x: x + width * (0.15 + Math.random() * 0.3),
        width: dormerWidth,
        roofHeight: roofHeight * 0.4,
        wallHeight: roofHeight * 0.55,
      }
    }

    buildings.push({ x, width, wallHeight, roofHeight, shade, windows, chimney, dormer })
    x += width - 2
  }
  return buildings
}

function makeSkyline() {
  const back = makeRow(-20, VIEW_WIDTH + 20, BACK_SHADES, 0.8)
  const front = makeRow(-20, VIEW_WIDTH + 20, FRONT_SHADES, 1)
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
  const roofTop = wallTop - b.roofHeight
  const peakX = b.x + b.width / 2
  const dormerBase = wallTop - b.roofHeight * 0.2

  ctx.globalAlpha = 1
  ctx.fillStyle = b.shade
  fillRect(ctx, b.x, wallTop, b.width, b.wallHeight)
  fillTriangle(ctx, b.x - 1.5, b.x + b.width + 1.5, wallTop, peakX, roofTop)
  if (b.chimney) {
    fillRect(ctx, b.chimney.x, wallTop - b.roofHeight * 0.55 - b.chimney.height, b.chimney.width, b.chimney.height)
  }
  if (b.dormer) {
    const d = b.dormer
    const dWallTop = dormerBase - d.wallHeight
    fillRect(ctx, d.x, dWallTop, d.width, d.wallHeight)
    fillTriangle(ctx, d.x - 1, d.x + d.width + 1, dWallTop, d.x + d.width / 2, dWallTop - d.roofHeight)
    ctx.fillStyle = WARM
    ctx.globalAlpha = 0.8
    fillRect(ctx, d.x + d.width * 0.25, dormerBase - d.wallHeight * 0.75, d.width * 0.5, d.wallHeight * 0.5)
  }

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

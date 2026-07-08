import { useMemo } from 'react'

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
  cat: boolean
}

const VIEW_WIDTH = 3000
const VIEW_HEIGHT = 130
const BACK_SHADES = ['#1a2440', '#1d2846']
const FRONT_SHADES = ['#0a0e1c', '#0d1226', '#101632']
const WARM = '#ffcf8a'
const CAT_COLOR = '#c9702f'
const CAT_SCALE = 0.6

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

function makeRow(startX: number, endX: number, shades: string[], scale: number, allowCat: boolean): Building[] {
  const buildings: Building[] = []
  let x = startX
  let catPlaced = !allowCat
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

    let cat = false
    if (!catPlaced && scale > 0.9 && Math.random() < 0.06) {
      cat = true
      catPlaced = true
    }

    buildings.push({ x, width, wallHeight, roofHeight, shade, windows, chimney, dormer, cat })
    x += width - 2
  }
  return buildings
}

function makeSkyline() {
  const back = makeRow(-20, VIEW_WIDTH + 20, BACK_SHADES, 0.8, false)
  const front = makeRow(-20, VIEW_WIDTH + 20, FRONT_SHADES, 1, true)
  return { back, front }
}

function BuildingShape({ b }: { b: Building }) {
  const wallTop = VIEW_HEIGHT - b.wallHeight
  const roofTop = wallTop - b.roofHeight
  const peakX = b.x + b.width / 2
  const dormerBase = wallTop - b.roofHeight * 0.2

  return (
    <g>
      <rect x={b.x} y={wallTop} width={b.width} height={b.wallHeight} fill={b.shade} />
      <polygon
        points={`${b.x - 1.5},${wallTop} ${peakX},${roofTop} ${b.x + b.width + 1.5},${wallTop}`}
        fill={b.shade}
      />
      {b.chimney && (
        <rect
          x={b.chimney.x}
          y={wallTop - b.roofHeight * 0.55 - b.chimney.height}
          width={b.chimney.width}
          height={b.chimney.height}
          fill={b.shade}
        />
      )}
      {b.dormer && (
        <g>
          <rect
            x={b.dormer.x}
            y={dormerBase - b.dormer.wallHeight}
            width={b.dormer.width}
            height={b.dormer.wallHeight}
            fill={b.shade}
          />
          <polygon
            points={`${b.dormer.x - 1},${dormerBase - b.dormer.wallHeight} ${
              b.dormer.x + b.dormer.width / 2
            },${dormerBase - b.dormer.wallHeight - b.dormer.roofHeight} ${
              b.dormer.x + b.dormer.width + 1
            },${dormerBase - b.dormer.wallHeight}`}
            fill={b.shade}
          />
          <rect
            x={b.dormer.x + b.dormer.width * 0.25}
            y={dormerBase - b.dormer.wallHeight * 0.75}
            width={b.dormer.width * 0.5}
            height={b.dormer.wallHeight * 0.5}
            fill={WARM}
            opacity={0.8}
          />
        </g>
      )}
      {b.windows.map((w, j) => {
        if (w.shape === 'arch') {
          return (
            <g key={j}>
              <rect x={w.x} y={w.y + w.h * 0.35} width={w.w} height={w.h * 0.65} fill={WARM} opacity={w.opacity} />
              <ellipse
                cx={w.x + w.w / 2}
                cy={w.y + w.h * 0.35}
                rx={w.w / 2}
                ry={w.h * 0.35}
                fill={WARM}
                opacity={w.opacity}
              />
            </g>
          )
        }
        if (w.shape === 'square') {
          const size = Math.min(w.w, w.h)
          return <rect key={j} x={w.x} y={w.y} width={size} height={size} fill={WARM} opacity={w.opacity} />
        }
        return <rect key={j} x={w.x} y={w.y} width={w.w} height={w.h} fill={WARM} opacity={w.opacity} />
      })}
      {b.cat && (
        <g
          fill={CAT_COLOR}
          transform={`translate(${peakX - 25 * CAT_SCALE}, ${roofTop - 27 * CAT_SCALE}) scale(${CAT_SCALE})`}
        >
          <path d="M 20 24 q -3 -1 -2 -4 q 1 -2 3 -1 q 1 -4 6 -4 q 5 0 6.5 4 q 3 0 3.5 3 q 0.3 2 -1.5 2.5 Z" />
          <circle cx="34" cy="13.5" r="3.6" />
          <path d="M 31 11 l 1 -3.4 l 1.6 2.6 Z" />
          <path d="M 34.6 10.2 l 1.4 -3.2 l 1.6 3 Z" />
          <path d="M 17 18 q -4 -1 -3.5 -5.5 q 2.5 0.5 3.5 5.5 Z" />
        </g>
      )}
    </g>
  )
}

export default function CitySkyline() {
  const { back, front } = useMemo(makeSkyline, [])

  return (
    <div className="city-skyline" aria-hidden="true">
      <svg
        width={VIEW_WIDTH}
        height={VIEW_HEIGHT}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      >
        {back.map((b, i) => (
          <BuildingShape key={`back-${i}`} b={b} />
        ))}
        {front.map((b, i) => (
          <BuildingShape key={`front-${i}`} b={b} />
        ))}
      </svg>
    </div>
  )
}

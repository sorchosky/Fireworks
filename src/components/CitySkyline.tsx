import { useMemo } from 'react'

interface Window {
  x: number
  y: number
  w: number
  h: number
  opacity: number
}

interface Building {
  x: number
  width: number
  height: number
  shade: string
  windows: Window[]
}

const VIEW_WIDTH = 400
const VIEW_HEIGHT = 100
const SHADES = ['#0a0e1c', '#0d1226', '#101632']

function makeBuildings(): Building[] {
  const buildings: Building[] = []
  let x = -10
  while (x < VIEW_WIDTH + 10) {
    const width = 18 + Math.random() * 26
    const height = 28 + Math.random() * 62
    const shade = SHADES[Math.floor(Math.random() * SHADES.length)]

    const windows: Window[] = []
    const cols = Math.max(1, Math.floor(width / 9))
    const rows = Math.max(1, Math.floor(height / 12))
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.35) {
          windows.push({
            x: x + 3 + c * (width / cols),
            y: VIEW_HEIGHT - height + 4 + r * (height / rows),
            w: width / cols - 4,
            h: height / rows - 6,
            opacity: 0.18 + Math.random() * 0.35,
          })
        }
      }
    }

    buildings.push({ x, width, height, shade, windows })
    x += width - 3
  }
  return buildings
}

export default function CitySkyline() {
  const buildings = useMemo(makeBuildings, [])

  return (
    <div className="city-skyline" aria-hidden="true">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
      >
        {buildings.map((b, i) => (
          <g key={i}>
            <rect
              x={b.x}
              y={VIEW_HEIGHT - b.height}
              width={b.width}
              height={b.height}
              fill={b.shade}
            />
            {b.windows.map((w, j) => (
              <rect
                key={j}
                x={w.x}
                y={w.y}
                width={w.w}
                height={w.h}
                fill="#ffcf8a"
                opacity={w.opacity}
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  )
}

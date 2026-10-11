import { useEffect, useRef } from 'react'
import StarField from './StarField'
import { PIXEL, bayer, hexToRgb } from '../engine/pixel'

// Same stops as the CSS gradient on .night-sky, which stays as a fallback.
const STOPS: [number, string][] = [
  [0, '#05070f'],
  [0.35, '#070a18'],
  [0.65, '#131a35'],
  [0.88, '#4a3b52'],
  [1, '#c97a5a'],
]
// The gradient is sampled into flat bands, then ordered-dithered between
// neighbouring bands so the transitions read as pixel-art shading.
const BANDS = 28

function sample(t: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i]
    if (t <= t1) {
      const [t0, c0] = STOPS[i - 1]
      const f = (t - t0) / (t1 - t0)
      const a = hexToRgb(c0)
      const b = hexToRgb(c1)
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
    }
  }
  return hexToRgb(STOPS[STOPS.length - 1][1])
}

const BAND_COLORS = Array.from({ length: BANDS }, (_, i) => sample(i / (BANDS - 1)).map(Math.round))

function drawSky(canvas: HTMLCanvasElement) {
  const cols = Math.ceil(window.innerWidth / PIXEL)
  const rows = Math.ceil(window.innerHeight / PIXEL)
  canvas.width = cols
  canvas.height = rows
  canvas.style.width = `${cols * PIXEL}px`
  canvas.style.height = `${rows * PIXEL}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const img = ctx.createImageData(cols, rows)
  const data = img.data
  for (let y = 0; y < rows; y++) {
    const f = (y / Math.max(1, rows - 1)) * (BANDS - 1)
    const lower = Math.floor(f)
    const frac = f - lower
    for (let x = 0; x < cols; x++) {
      const band = frac > bayer(x, y) ? Math.min(BANDS - 1, lower + 1) : lower
      const c = BAND_COLORS[band]
      const i = (y * cols + x) * 4
      data[i] = c[0]
      data[i + 1] = c[1]
      data[i + 2] = c[2]
      data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

export default function NightSky() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const redraw = () => drawSky(canvas)
    redraw()
    window.addEventListener('resize', redraw)
    window.addEventListener('orientationchange', redraw)
    return () => {
      window.removeEventListener('resize', redraw)
      window.removeEventListener('orientationchange', redraw)
    }
  }, [])

  return (
    <div className="night-sky" aria-hidden="true">
      <canvas ref={canvasRef} className="pixel-layer" />
      <StarField />
    </div>
  )
}

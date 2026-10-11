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

// Clouds lighten the sky toward a cool haze up high and the warm horizon
// glow lower down, so they pick up the existing palette.
const CLOUD_HIGH = hexToRgb('#4a3b52')
const CLOUD_LOW = hexToRgb('#c97a5a')
const CLOUD_STRENGTH = 0.22
const MOON_LIGHT = hexToRgb('#f4ecd2')
const MOON_SHADE = hexToRgb('#d9cba6')
const MOON_HALO = hexToRgb('#8a8fb8')

// Deterministic value noise, so clouds keep their shape across resizes.
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = smooth(x - x0)
  const fy = smooth(y - y0)
  const a = hash(x0, y0)
  const b = hash(x0 + 1, y0)
  const c = hash(x0, y0 + 1)
  const d = hash(x0 + 1, y0 + 1)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

function fbm(x: number, y: number): number {
  let sum = 0
  let amp = 0.5
  let freq = 1
  for (let i = 0; i < 4; i++) {
    sum += amp * valueNoise(x * freq, y * freq)
    amp *= 0.5
    freq *= 2
  }
  return sum / 0.9375
}

function mix(a: number[], b: number[], t: number): number[] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

// Thin wisps stretched horizontally, kept to the middle of the sky and
// quantized into a few dithered levels so they stay pixel-crisp.
function cloudAmount(x: number, y: number, rows: number): number {
  const t = y / rows
  const band = Math.max(0, 1 - Math.abs(t - 0.55) / 0.3)
  if (band <= 0) return 0
  const n = fbm(x / 34, y / 7)
  const density = Math.max(0, (n - 0.52) / 0.3) * band
  const level = Math.min(3, Math.floor(density * 3 + bayer(x, y)))
  return (level / 3) * CLOUD_STRENGTH
}

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
    const cloudTint = mix(CLOUD_HIGH, CLOUD_LOW, Math.max(0, (y / rows - 0.4) / 0.6))
    for (let x = 0; x < cols; x++) {
      const band = frac > bayer(x, y) ? Math.min(BANDS - 1, lower + 1) : lower
      let c: number[] = BAND_COLORS[band]
      const cloud = cloudAmount(x, y, rows)
      if (cloud > 0) c = mix(c, cloudTint, cloud)
      const i = (y * cols + x) * 4
      data[i] = c[0]
      data[i + 1] = c[1]
      data[i + 2] = c[2]
      data[i + 3] = 255
    }
  }
  drawMoon(data, cols, rows)
  ctx.putImageData(img, 0, 0)
}

function blendPixel(data: Uint8ClampedArray, cols: number, rows: number, x: number, y: number, color: number[], t: number) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return
  const i = (y * cols + x) * 4
  data[i] += (color[0] - data[i]) * t
  data[i + 1] += (color[1] - data[i + 1]) * t
  data[i + 2] += (color[2] - data[i + 2]) * t
}

// Pixel moon in the upper sky with a dithered halo, a soft shaded limb and
// a few craters.
function drawMoon(data: Uint8ClampedArray, cols: number, rows: number) {
  const r = 6
  const cx = Math.round(cols * (cols > rows ? 0.8 : 0.72))
  const cy = Math.round(Math.max(r * 3, rows * 0.14))
  const haloR = r * 3.2
  for (let y = Math.floor(cy - haloR); y <= cy + haloR; y++) {
    for (let x = Math.floor(cx - haloR); x <= cx + haloR; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const d = Math.hypot(dx, dy)
      if (d <= r) {
        // Lit from the upper right, so the lower-left edge falls into shade.
        const shade = (-dx * 0.7 + dy * 0.7) / r > 0.45
        blendPixel(data, cols, rows, x, y, shade ? MOON_SHADE : MOON_LIGHT, 1)
      } else if (d <= haloR) {
        const falloff = 1 - (d - r) / (haloR - r)
        const level = Math.floor(falloff * 3 + bayer(x, y)) / 3
        blendPixel(data, cols, rows, x, y, MOON_HALO, level * 0.18)
      }
    }
  }
  const craters = [
    [-2, -1],
    [1, 2],
    [2, -3],
    [-1, 3],
  ]
  for (const [dx, dy] of craters) blendPixel(data, cols, rows, cx + dx, cy + dy, MOON_SHADE, 1)
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

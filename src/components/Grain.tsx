import { useMemo } from 'react'
import { PIXEL } from '../engine/pixel'

const TILE = 64

// Random light and dark specks on the art-pixel grid, tiled across the
// screen at low opacity for a printed, grainy finish.
function makeNoiseTile(): string {
  const canvas = document.createElement('canvas')
  canvas.width = TILE
  canvas.height = TILE
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(TILE, TILE)
  const data = img.data
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() < 0.5 ? 0 : 255
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
    data[i + 3] = Math.random() * 255
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}

export default function Grain() {
  const tile = useMemo(makeNoiseTile, [])
  return (
    <div
      className="grain"
      aria-hidden="true"
      style={{
        backgroundImage: tile ? `url(${tile})` : undefined,
        backgroundSize: `${TILE * PIXEL}px ${TILE * PIXEL}px`,
      }}
    />
  )
}

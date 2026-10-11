import { useMemo, type CSSProperties } from 'react'
import { PIXEL } from '../engine/pixel'

interface Star {
  x: number
  y: number
  size: number
  baseOpacity: number
  duration: number
  delay: number
}

const STAR_COUNT = 45

function makeStars(): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * 100,
      y: Math.random() * 60,
      // A few brighter stars are two art pixels wide.
      size: Math.random() < 0.15 ? PIXEL * 2 : PIXEL,
      baseOpacity: 0.15 + Math.random() * 0.35,
      duration: 3.5 + Math.random() * 4.5,
      delay: Math.random() * 5,
    })
  }
  return stars
}

export default function StarField() {
  const stars = useMemo(makeStars, [])

  return (
    <div className="star-field" aria-hidden="true">
      {stars.map((s, i) => (
        <div
          key={i}
          className="star"
          style={
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
              '--base-opacity': s.baseOpacity,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

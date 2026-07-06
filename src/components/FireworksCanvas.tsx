import { useEffect, useRef } from 'react'
import { FireworksEngine } from '../engine/fireworks'
import { playBurstSound, unlockAudio } from '../engine/audio'

const MAX_DT = 1 / 20

export default function FireworksCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<FireworksEngine | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new FireworksEngine(canvas)
    engineRef.current = engine
    engine.setBurstListener((_x, _y, type) => playBurstSound(type))

    const resize = () => {
      engine.resize(window.innerWidth, window.innerHeight)
    }
    resize()

    const tick = (time: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = time
      const dt = Math.min((time - lastTimeRef.current) / 1000, MAX_DT)
      lastTimeRef.current = time
      engine.update(dt)
      engine.draw()
      rafRef.current = requestAnimationFrame(tick)
    }

    const start = () => {
      if (rafRef.current === null) {
        lastTimeRef.current = null
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    const stop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    const handleVisibility = () => {
      if (document.hidden) stop()
      else start()
    }

    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', resize)
    document.addEventListener('visibilitychange', handleVisibility)

    start()

    return () => {
      stop()
      window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', resize)
      document.removeEventListener('visibilitychange', handleVisibility)
      engineRef.current = null
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    unlockAudio()
    const canvas = canvasRef.current
    const engine = engineRef.current
    if (!canvas || !engine) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    engine.spawnRocket(x, y)
  }

  return (
    <canvas
      ref={canvasRef}
      className="fireworks-canvas"
      onPointerDown={handlePointerDown}
    />
  )
}

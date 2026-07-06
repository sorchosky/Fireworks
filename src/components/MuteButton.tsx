import { useState } from 'react'
import { getMuted, toggleMuted, unlockAudio } from '../engine/audio'

export default function MuteButton() {
  const [muted, setMuted] = useState(getMuted())

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
  }

  const handleClick = () => {
    unlockAudio()
    setMuted(toggleMuted())
  }

  return (
    <button
      type="button"
      className="mute-button"
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}

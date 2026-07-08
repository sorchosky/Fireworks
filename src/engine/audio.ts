import type { BurstType } from './types'

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
let muted = false

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    masterGain = ctx.createGain()
    masterGain.gain.value = 0.35
    masterGain.connect(ctx.destination)
  }
  return ctx
}

function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer
  const length = context.sampleRate * 0.6
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  noiseBuffer = buffer
  return buffer
}

/** Must be called from within a user gesture (e.g. pointerdown) to unlock iOS audio. */
export function unlockAudio() {
  const c = ensureContext()
  if (c && c.state === 'suspended') {
    void c.resume()
  }
}

export function setMuted(value: boolean) {
  muted = value
}

export function toggleMuted(): boolean {
  muted = !muted
  return muted
}

export function getMuted() {
  return muted
}

function playBoom(context: AudioContext, dest: AudioNode, strength: number) {
  const now = context.currentTime
  const osc = context.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(120, now)
  osc.frequency.exponentialRampToValueAtTime(38, now + 0.45)

  const gain = context.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.6 * strength, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)

  osc.connect(gain)
  gain.connect(dest)
  osc.start(now)
  osc.stop(now + 0.6)

  const noiseSrc = context.createBufferSource()
  noiseSrc.buffer = getNoiseBuffer(context)
  const noiseFilter = context.createBiquadFilter()
  noiseFilter.type = 'lowpass'
  noiseFilter.frequency.value = 500
  const noiseGain = context.createGain()
  noiseGain.gain.setValueAtTime(0.0001, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.35 * strength, now + 0.015)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)

  noiseSrc.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(dest)
  noiseSrc.start(now)
  noiseSrc.stop(now + 0.4)
}

function playCrackle(context: AudioContext, dest: AudioNode, strength: number) {
  const popCount = 4 + Math.floor(Math.random() * 5)
  for (let i = 0; i < popCount; i++) {
    const delay = Math.random() * 0.5 + 0.05
    const now = context.currentTime + delay

    const src = context.createBufferSource()
    src.buffer = getNoiseBuffer(context)
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2500 + Math.random() * 3000
    filter.Q.value = 4

    const gain = context.createGain()
    const peak = (0.06 + Math.random() * 0.08) * strength
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06 + Math.random() * 0.05)

    src.connect(filter)
    filter.connect(gain)
    gain.connect(dest)
    src.start(now)
    src.stop(now + 0.15)
  }
}

export function playBurstSound(type: BurstType) {
  if (muted) return
  const context = ensureContext()
  if (!context || !masterGain) return
  if (context.state === 'suspended') void context.resume()

  switch (type) {
    case 'peony':
    case 'ring':
      playBoom(context, masterGain, 1)
      playCrackle(context, masterGain, 0.5)
      break
    case 'colorShift':
      playBoom(context, masterGain, 0.75)
      playCrackle(context, masterGain, 0.6)
      break
    case 'crackle':
      playBoom(context, masterGain, 0.55)
      playCrackle(context, masterGain, 1)
      break
    case 'willow':
    case 'shimmer':
      playBoom(context, masterGain, 0.35)
      playCrackle(context, masterGain, 0.7)
      break
    case 'heart':
    case 'square':
    case 'star':
      playBoom(context, masterGain, 0.7)
      playCrackle(context, masterGain, 0.6)
      break
  }
}

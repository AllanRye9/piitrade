// Web Audio API sound notifications for trading events
let audioCtx = null

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioCtx
}

function playTone(freq, duration, type = 'sine', gain = 0.12, startOffset = 0) {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    osc.frequency.value = freq
    osc.type = type
    const start = ctx.currentTime + startOffset
    gainNode.gain.setValueAtTime(gain, start)
    gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration)
    osc.start(start)
    osc.stop(start + duration)
  } catch {
    // Silently ignore - browser may block autoplay
  }
}

// Session opening: ascending arpeggio
export function playSessionStart() {
  playTone(523.25, 0.15, 'sine', 0.12, 0)     // C5
  playTone(659.25, 0.15, 'sine', 0.12, 0.15)  // E5
  playTone(783.99, 0.2,  'sine', 0.12, 0.3)   // G5
}

// Session closing: descending arpeggio
export function playSessionEnd() {
  playTone(783.99, 0.15, 'sine', 0.1, 0)     // G5
  playTone(659.25, 0.15, 'sine', 0.1, 0.15)  // E5
  playTone(523.25, 0.2,  'sine', 0.1, 0.3)   // C5
}

// Take Profit hit: bright ascending trio
export function playTP() {
  playTone(880,  0.12, 'sine', 0.12, 0)
  playTone(1108, 0.12, 'sine', 0.12, 0.12)
  playTone(1318, 0.22, 'sine', 0.12, 0.24)
}

// Stop Loss hit: low descending buzz
export function playSL() {
  playTone(320, 0.15, 'sawtooth', 0.08, 0)
  playTone(240, 0.25, 'sawtooth', 0.06, 0.15)
}

// Entry executed: short double-beep
export function playEntry() {
  playTone(660, 0.1, 'sine', 0.1, 0)
  playTone(880, 0.15, 'sine', 0.1, 0.12)
}

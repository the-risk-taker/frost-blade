let ac

export function unlockAudio() {
  ac ??= new AudioContext()
  if (ac.state === 'suspended') ac.resume()
}

function envelope(volume, duration) {
  const gain = ac.createGain()
  gain.gain.setValueAtTime(volume, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
  gain.connect(ac.destination)
  return gain
}

function tone(from, to, duration, type, volume) {
  if (!ac) return
  const osc = ac.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(to, ac.currentTime + duration)
  osc.connect(envelope(volume, duration))
  osc.start()
  osc.stop(ac.currentTime + duration)
}

function noise(duration, volume, frequency) {
  if (!ac) return
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = frequency
  src.connect(filter).connect(envelope(volume, duration))
  src.start()
}

export const sfx = {
  swing: () => noise(0.12, 0.3, 2200),
  hit: () => { noise(0.1, 0.5, 700); tone(180, 60, 0.12, 'square', 0.1) },
  smash: () => { noise(0.35, 0.8, 180); tone(90, 30, 0.35, 'sine', 0.5) },
  jump: () => tone(280, 560, 0.12, 'square', 0.06),
  roll: () => noise(0.25, 0.25, 500),
  cast: () => { tone(900, 1900, 0.25, 'triangle', 0.12); noise(0.2, 0.15, 5000) },
  hurt: () => tone(240, 80, 0.3, 'sawtooth', 0.15),
  potion: () => tone(400, 1000, 0.35, 'sine', 0.15),
  lunge: () => { tone(160, 90, 0.25, 'sawtooth', 0.12); noise(0.2, 0.2, 900) },
  shoot: () => { tone(700, 300, 0.12, 'triangle', 0.1); noise(0.08, 0.15, 3000) },
  pickup: () => tone(600, 1200, 0.1, 'square', 0.05),
  coin: () => tone(1400, 2000, 0.12, 'square', 0.05),
}

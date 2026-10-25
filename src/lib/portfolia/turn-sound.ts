/**
 * A soft paper sound for a turning page, made on the spot (filtered noise that sweeps down as the sheet lands), so
 * there is no recording to download or license. Browsers start sound only after the reader has pressed something,
 * which a page turn by hand is; an automatic turn before that stays silent.
 */
let context: AudioContext | null = null;
let noise: AudioBuffer | null = null;

export function playTurnSound(volume = 0.16) {
  try {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    context ??= new Context();
    if (context.state === "suspended") void context.resume();
    const ctx = context;
    if (!noise) {
      noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.6), ctx.sampleRate);
      const data = noise.getChannelData(0);
      // Brown-ish noise: softer and more papery than white noise.
      let last = 0;
      for (let i = 0; i < data.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.5; }
    }
    const now = ctx.currentTime, length = 0.42 + Math.random() * 0.08;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.playbackRate.value = 0.9 + Math.random() * 0.2;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 0.8;
    band.frequency.setValueAtTime(2600, now);
    band.frequency.exponentialRampToValueAtTime(700, now + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(volume * 0.45, now + length * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    source.connect(band).connect(gain).connect(ctx.destination);
    source.start(now);
    source.stop(now + length + 0.05);
  } catch {
    /* sound is a nicety; a browser without it reads the same */
  }
}

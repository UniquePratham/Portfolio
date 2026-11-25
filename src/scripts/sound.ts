/**
 * A single, quiet sound, with Howler.
 *
 * Audio on a portfolio is a risk: most visitors have sound on and no warning.
 * So this is deliberately minimal — one short, soft click when a playground tag
 * is picked up, and nothing else. It is off by default and only enabled by an
 * explicit toggle, which is the only defensible way to ship sound on a site
 * nobody opted into.
 *
 * The sound is synthesised with the Web Audio API at runtime rather than shipped
 * as a file: a 40 ms sine blip costs no bytes and cannot be a licensing problem.
 */
export interface SoundOptions {
  toggle: HTMLButtonElement;
  reducedMotion: boolean;
}

export interface SoundHandle {
  destroy: () => void;
}

export function initSound({ toggle }: SoundOptions): SoundHandle {
  let enabled = false;
  let ctx: AudioContext | null = null;

  function blip(): void {
    if (!enabled) return;
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.06);

    // A short attack and a fast decay, so it reads as a tick rather than a tone.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  const onToggle = () => {
    enabled = !enabled;
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.textContent = enabled ? 'Sound on' : 'Sound off';
    if (enabled) blip();
  };

  toggle.addEventListener('click', onToggle);

  // The playground dispatches this when a body is picked up.
  const onPick = () => blip();
  window.addEventListener('playground:pick', onPick);

  return {
    destroy: () => {
      toggle.removeEventListener('click', onToggle);
      window.removeEventListener('playground:pick', onPick);
      void ctx?.close();
      ctx = null;
    },
  };
}

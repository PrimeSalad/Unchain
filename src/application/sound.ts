/**
 * App sounds - tiny synthesized WAVs (generated in-house, no third-party audio).
 * Everything is fire-and-forget and failure-safe: if audio can't play we stay silent.
 */
import { isExpoGo } from '@/application/expoGo';
import type { AudioPlayer } from 'expo-audio';

const SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  flip: require('../../assets/sounds/flip.wav'),
  place: require('../../assets/sounds/place.wav'),
  capture: require('../../assets/sounds/capture.wav'),
  clear: require('../../assets/sounds/clear.wav'),
  win: require('../../assets/sounds/win.wav'),
  lose: require('../../assets/sounds/lose.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

let configured = false;
let audioModule: typeof import('expo-audio') | null = null;

async function loadAudioModule(): Promise<typeof import('expo-audio') | null> {
  if (isExpoGo()) return null;
  if (audioModule) return audioModule;
  try {
    audioModule = await import('expo-audio');
    return audioModule;
  } catch {
    return null;
  }
}

async function ensureMode() {
  if (configured) return;
  configured = true;
  try {
    const mod = await loadAudioModule();
    if (!mod) return;
    await mod.setAudioModeAsync({ playsInSilentMode: true });
  } catch {
    /* keep silent */
  }
}

const players = new Map<SoundName, AudioPlayer>();

/** Swallow both sync throws and async rejections from a native audio call. */
function safe(fn: () => unknown) {
  try {
    const r = fn();
    if (r && typeof (r as Promise<unknown>).catch === 'function') {
      (r as Promise<unknown>).catch(() => {});
    }
  } catch {
    /* keep silent */
  }
}

/** Play a short effect. Safe to call from anywhere, any number of times. */
export function playSound(name: SoundName, volume = 1) {
  void (async () => {
    try {
      if (isExpoGo()) return;
      await ensureMode();
      if (!audioModule) return;
      let p = players.get(name);
      if (!p) {
        p = audioModule.createAudioPlayer(SOURCES[name]);
        players.set(name, p);
      }
      p.volume = volume;
      // seekTo is async native work - a rejection (e.g. still loading) must
      // never surface as an unhandled error mid-game.
      safe(() => p!.seekTo(0));
      safe(() => p!.play());
    } catch {
      /* keep silent */
    }
  })();
}

// ── Calming music (Mindful Pause) ──────────────────────────────────────────

let music: AudioPlayer | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;

/** Start the seamless ambient loop, fading in gently. */
export function startCalmMusic() {
  void (async () => {
    try {
      if (isExpoGo()) return;
      await ensureMode();
      if (!audioModule) return;
      stopFade();
      if (!music) {
        music = audioModule.createAudioPlayer(require('../../assets/sounds/calm-loop.wav'));
        music.loop = true;
      }
      music.volume = 0;
      safe(() => music!.seekTo(0));
      safe(() => music!.play());
      fadeTo(0.6, 2000);
    } catch {
      /* keep silent */
    }
  })();
}

export function setCalmMusicPaused(paused: boolean) {
  try {
    if (isExpoGo()) return;
    if (!music) return;
    if (paused) music.pause();
    else music.play();
  } catch {
    /* keep silent */
  }
}

/** Fade out and release the music. */
export function stopCalmMusic() {
  if (isExpoGo()) return;
  const m = music;
  if (!m) return;
  music = null;
  stopFade();
  try {
    const start = m.volume;
    const steps = 12;
    let i = 0;
    const id = setInterval(() => {
      i++;
      try {
        m.volume = Math.max(0, start * (1 - i / steps));
        if (i >= steps) {
          clearInterval(id);
          m.pause();
          m.remove();
        }
      } catch {
        clearInterval(id);
      }
    }, 90);
  } catch {
    /* keep silent */
  }
}

function fadeTo(target: number, ms: number) {
  const m = music;
  if (!m) return;
  stopFade();
  const steps = Math.max(1, Math.round(ms / 90));
  let i = 0;
  const from = m.volume;
  fadeTimer = setInterval(() => {
    i++;
    try {
      m.volume = from + ((target - from) * i) / steps;
    } catch {
      stopFade();
      return;
    }
    if (i >= steps) stopFade();
  }, 90);
}

function stopFade() {
  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
}

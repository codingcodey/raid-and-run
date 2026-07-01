import { assetPath } from "./asset-path";
import type { GameState } from "./types";

type AudioKey = keyof typeof AUDIO_PATHS;
type EffectKey = "coinSound" | "deathSound" | "fireballSound" | "firstCoinSound" | "buttonClickSound";
type MusicMode = "preCoin" | "active" | "gameOver" | "none";

const AUDIO_PATHS = {
  preCoinMusic: assetPath("assets/audio/elevator.mp3"),
  activeMusic: assetPath("assets/audio/outro-song.mp3"),
  deathSound: assetPath("assets/audio/wilhelm-scream.mp3"),
  gameOverMusic: assetPath("assets/audio/spiderman-meme.mp3"),
  coinSound: assetPath("assets/audio/mario-coin.mp3"),
  fireballSound: assetPath("assets/audio/ghast-fireball.mp3"),
  firstCoinSound: assetPath("assets/audio/dun-dun-dun.mp3"),
  buttonClickSound: assetPath("assets/audio/button-click.mp3"),
} as const;

const VOLUMES: Record<AudioKey, number> = {
  preCoinMusic: 0.36,
  activeMusic: 0.39,
  deathSound: 0.8,
  gameOverMusic: 0.36,
  coinSound: 0.72,
  fireballSound: 0.64,
  firstCoinSound: 0.82,
  buttonClickSound: 0.82,
};

type AudioContextConstructor = new () => AudioContext;

interface WindowWithAudioContext extends Window {
  AudioContext?: AudioContextConstructor;
  webkitAudioContext?: AudioContextConstructor;
}

export class GameAudio {
  private readonly context: AudioContext | null;
  private readonly buffers = new Map<AudioKey, AudioBuffer>();
  private readonly loading = new Map<AudioKey, Promise<AudioBuffer | null>>();
  private readonly activeEffects = new Set<AudioBufferSourceNode>();
  private currentMusic: AudioBufferSourceNode | null = null;
  private mode: MusicMode = "none";
  private requestedMode: MusicMode = "none";
  private pendingMode: MusicMode = "none";
  private unlocked = false;
  private deathSequenceStarted = false;

  constructor() {
    this.context = createAudioContext();

    if (this.context) {
      for (const key of Object.keys(AUDIO_PATHS) as AudioKey[]) {
        this.loading.set(key, this.loadBuffer(key));
      }
    }
  }

  unlock(state: GameState): void {
    this.unlocked = true;
    void this.context?.resume();
    this.syncMusic(state);
  }

  syncMusic(state: GameState): void {
    if (!this.unlocked || !this.context) {
      return;
    }

    if (state.gameStatus === "gameOver") {
      return;
    }

    this.deathSequenceStarted = false;
    this.requestMusic(state.score === 0 ? "preCoin" : "active");
  }

  playCoin(): void {
    if (!this.unlocked) {
      return;
    }

    this.playLoadedEffect("coinSound");
  }

  playFirstCoin(): void {
    if (!this.unlocked) {
      return;
    }

    this.playLoadedEffect("firstCoinSound");
  }

  playFireball(): void {
    if (!this.unlocked) {
      return;
    }

    this.playLoadedEffect("fireballSound");
  }

  playButtonClick(): void {
    if (!this.unlocked) {
      return;
    }

    this.playLoadedEffect("buttonClickSound");
  }

  playDeathSequence(): void {
    if (!this.unlocked || this.deathSequenceStarted) {
      return;
    }

    this.deathSequenceStarted = true;
    this.stopMusic();
    this.requestedMode = "none";
    this.playEffect("deathSound", () => {
      if (this.deathSequenceStarted) {
        this.requestMusic("gameOver");
      }
    });
  }

  reset(state: GameState): void {
    this.deathSequenceStarted = false;
    this.stopMusic();
    this.stopEffects();
    this.requestedMode = "none";
    this.pendingMode = "none";
    this.syncMusic(state);
  }

  private requestMusic(mode: Exclude<MusicMode, "none">): void {
    if (this.requestedMode === mode && (this.mode === mode || this.pendingMode === mode)) {
      return;
    }

    this.requestedMode = mode;
    void this.startMusic(mode);
  }

  private async startMusic(mode: Exclude<MusicMode, "none">): Promise<void> {
    if (!this.context) {
      return;
    }

    this.pendingMode = mode;
    const buffer = await this.getBuffer(keyForMode(mode));

    if (!buffer || !this.unlocked || this.requestedMode !== mode) {
      if (this.pendingMode === mode) {
        this.pendingMode = "none";
      }
      return;
    }

    await this.context.resume();

    if (this.requestedMode !== mode) {
      return;
    }

    this.stopMusic();
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = VOLUMES[keyForMode(mode)];
    source.connect(gain).connect(this.context.destination);
    source.start();

    this.currentMusic = source;
    this.mode = mode;
    this.pendingMode = "none";
  }

  private stopMusic(): void {
    if (this.currentMusic) {
      try {
        this.currentMusic.stop();
      } catch {
        // Already stopped.
      }
    }

    this.currentMusic = null;
    this.mode = "none";
  }

  private playEffect(key: EffectKey, onEnded?: () => void): void {
    if (!this.context) {
      return;
    }

    const loadedBuffer = this.buffers.get(key);

    if (loadedBuffer) {
      this.startEffect(key, loadedBuffer, onEnded);
      return;
    }

    void this.getBuffer(key).then((buffer) => {
      if (buffer && this.unlocked) {
        this.startEffect(key, buffer, onEnded);
      }
    });
  }

  private playLoadedEffect(key: EffectKey): void {
    const loadedBuffer = this.buffers.get(key);

    if (loadedBuffer) {
      this.startEffect(key, loadedBuffer);
    }
  }

  private startEffect(key: EffectKey, buffer: AudioBuffer, onEnded?: () => void): void {
    if (!this.context) {
      return;
    }

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = VOLUMES[key];
    source.connect(gain).connect(this.context.destination);
    source.addEventListener("ended", () => {
      this.activeEffects.delete(source);
      onEnded?.();
    });
    this.activeEffects.add(source);
    source.start();
  }

  private stopEffects(): void {
    for (const source of this.activeEffects) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }

    this.activeEffects.clear();
  }

  private async getBuffer(key: AudioKey): Promise<AudioBuffer | null> {
    const buffer = this.buffers.get(key);

    if (buffer) {
      return buffer;
    }

    return this.loading.get(key) ?? null;
  }

  private async loadBuffer(key: AudioKey): Promise<AudioBuffer | null> {
    if (!this.context) {
      return null;
    }

    try {
      const response = await fetch(AUDIO_PATHS[key]);
      if (!response.ok) {
        return null;
      }

      const data = await response.arrayBuffer();
      const buffer = await this.context.decodeAudioData(data);
      this.buffers.set(key, buffer);
      return buffer;
    } catch {
      return null;
    }
  }
}

function createAudioContext(): AudioContext | null {
  const audioWindow = window as WindowWithAudioContext;
  const AudioContextClass = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function keyForMode(mode: Exclude<MusicMode, "none">): "preCoinMusic" | "activeMusic" | "gameOverMusic" {
  if (mode === "preCoin") {
    return "preCoinMusic";
  }

  if (mode === "active") {
    return "activeMusic";
  }

  return "gameOverMusic";
}

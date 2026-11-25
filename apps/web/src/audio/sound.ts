/**
 * 배경음·효과음 (08 §5, D-078). 파일은 ElevenLabs로 만들어 `public/audio/`에 있다.
 * - 브라우저 자동 재생 제한: 처음 화면을 누른 순간 AudioContext를 만들고, 그때부터 파일을 받는다
 * - 배경음은 Web Audio 버퍼 반복(이음새 없음), 바뀔 때 1초 크로스페이드. 풀어 둔 곡은 최대 2곡
 * - 소리 끄기는 기기에 기억한다. 끄면 아무것도 받지 않는다. 탭이 숨으면 멈춘다
 */
import { signal } from "@preact/signals";

export type Bgm = "street" | "saju" | "tarot" | "dolyeong" | "dream";
export type Sfx = "tap" | "step" | "door" | "bell" | "shuffle" | "flip" | "pour" | "reveal";

const SFX: Sfx[] = ["tap", "step", "door", "bell", "shuffle", "flip", "pour", "reveal"];
/** 효과음마다 크기 (발소리·누르기는 작게) */
const SFX_GAIN: Record<Sfx, number> = {
  tap: 0.35,
  step: 0.22,
  door: 0.7,
  bell: 0.75,
  shuffle: 0.7,
  flip: 0.6,
  pour: 0.6,
  reveal: 0.6,
};
const BGM_GAIN = 0.45;
const FADE_S = 1;
/** mp3 앞뒤에 붙는 짧은 여백을 건너뛰어 반복 이음새에 틈이 없게 한다 */
const LOOP_TRIM_S = 0.025;
const KEY = "fortune.sound";

const url = (name: string) => `${import.meta.env.BASE_URL}audio/${name}.mp3`;

function readPref(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

/** 소리 켜짐 (버튼이 본다) */
export const soundOn = signal(readPref());

let ctx: AudioContext | null = null;
let bgmBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let wanted: Bgm | null = null;
let playing: { name: Bgm; src: AudioBufferSourceNode; gain: GainNode } | null = null;
let token = 0;
const bgmBuf = new Map<Bgm, Promise<AudioBuffer>>();
const sfxBuf = new Map<Sfx, Promise<AudioBuffer | null>>();

async function decode(name: string): Promise<AudioBuffer> {
  const res = await fetch(url(name));
  if (!res.ok) throw new Error(`audio ${name} ${res.status}`);
  const data = await res.arrayBuffer();
  if (!ctx) throw new Error("no audio context");
  return ctx.decodeAudioData(data);
}

function bgmBuffer(name: Bgm): Promise<AudioBuffer> {
  let p = bgmBuf.get(name);
  if (!p) {
    p = decode(`bgm-${name}`);
    p.catch(() => bgmBuf.delete(name));
    bgmBuf.set(name, p);
  }
  // 최대 2곡: 거리 곡과 지금 곡만 남긴다 (07 §5)
  for (const k of bgmBuf.keys()) {
    if (bgmBuf.size <= 2) break;
    if (k !== name && k !== "street" && k !== playing?.name) bgmBuf.delete(k);
  }
  return p;
}

function loadSfx() {
  for (const s of SFX) {
    if (sfxBuf.has(s)) continue;
    sfxBuf.set(
      s,
      decode(`sfx-${s}`).catch(() => null),
    );
  }
}

function fadeOut(p: NonNullable<typeof playing>) {
  if (!ctx) return;
  const t = ctx.currentTime;
  p.gain.gain.cancelScheduledValues(t);
  p.gain.gain.setValueAtTime(p.gain.gain.value, t);
  p.gain.gain.linearRampToValueAtTime(0, t + FADE_S);
  p.src.stop(t + FADE_S + 0.05);
}

async function startBgm(name: Bgm) {
  if (!ctx || !bgmBus || playing?.name === name) return;
  const my = ++token;
  let buf: AudioBuffer;
  try {
    buf = await bgmBuffer(name);
  } catch {
    return; // 못 받으면 조용히 넘어간다
  }
  if (my !== token || !ctx || !bgmBus || wanted !== name) return;
  if (playing) fadeOut(playing);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = LOOP_TRIM_S;
  src.loopEnd = Math.max(LOOP_TRIM_S + 1, buf.duration - LOOP_TRIM_S);
  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(1, t + FADE_S);
  src.connect(gain).connect(bgmBus);
  src.start(t, LOOP_TRIM_S);
  playing = { name, src, gain };
}

/** 처음 누를 때(사용자 동작 안에서) 불러야 한다. iOS는 이 안에서 만들고 resume해야 소리가 난다 */
function unlock() {
  if (!soundOn.value || document.hidden) return;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC({ latencyHint: "interactive" });
    bgmBus = ctx.createGain();
    bgmBus.gain.value = BGM_GAIN;
    bgmBus.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.connect(ctx.destination);
  }
  if (ctx.state !== "running") void ctx.resume();
  loadSfx();
  if (wanted) void startBgm(wanted);
}

/** 지금 화면의 배경음. 아직 누르기 전이면 기억만 해 둔다 */
export function setBgm(name: Bgm) {
  wanted = name;
  if (ctx && soundOn.value) void startBgm(name);
}

export function sfx(name: Sfx) {
  if (!ctx || !sfxBus || !soundOn.value || ctx.state !== "running") return;
  const c = ctx;
  const bus = sfxBus;
  void sfxBuf.get(name)?.then((buf) => {
    if (!buf || c.state !== "running") return;
    const src = c.createBufferSource();
    src.buffer = buf;
    // 자주 나는 소리는 높낮이를 살짝 흔들어 덜 기계적으로
    if (name === "step" || name === "tap" || name === "flip") {
      src.playbackRate.value = 0.92 + Math.random() * 0.16;
    }
    const g = c.createGain();
    g.gain.value = SFX_GAIN[name];
    src.connect(g).connect(bus);
    src.start();
  });
}

export function setSoundOn(on: boolean) {
  soundOn.value = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // 저장 못 해도 이번 접속 동안은 따른다
  }
  if (on) {
    unlock(); // 버튼을 누른 순간이라 사용자 동작 안이다
  } else if (ctx) {
    void ctx.suspend();
  }
}

let installed = false;

/** main.tsx에서 한 번 */
export function installSound() {
  if (installed) return;
  installed = true;
  const first = () => unlock();
  // 캡처 단계에서 받아야 캔버스·버튼이 이벤트를 막아도 열린다
  window.addEventListener("pointerdown", first, { capture: true });
  window.addEventListener("keydown", first, { capture: true });
  // 모든 버튼에 누르는 소리
  document.addEventListener(
    "click",
    (e) => {
      const el = e.target as Element | null;
      if (el?.closest?.("button:not(:disabled)")) sfx("tap");
    },
    { capture: true },
  );
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else if (soundOn.value) void ctx.resume();
  });
}

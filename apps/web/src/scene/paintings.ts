/**
 * 점집 안 그림을 캔버스로 그린다 (D-030: 2D는 코드로, 07 §4: 텍스처는 1024 이하, 한 번만 래스터화).
 * 사주집: 먹 산수 병풍 + 족자 글씨 + 사주판 (한 장에 모아 그린다) / 아기도령: 일월오봉도.
 */
import * as THREE from "three";
import { rng } from "./geo";

const SERIF = '"Gowun Batang", "AppleMyungjo", "Noto Serif KR", "Noto Serif CJK KR", serif';

type Ctx = CanvasRenderingContext2D;

/** 겹겹 산 능선: 아래로 갈수록 옅어지는 먹 */
function ridge(
  ctx: Ctx,
  x0: number,
  x1: number,
  base: number,
  peak: number,
  color: string,
  seed: number,
  jag = 1,
) {
  const r = rng(seed);
  ctx.beginPath();
  ctx.moveTo(x0, base + 60);
  const n = 26;
  let h = 0.4;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    h += (r() - 0.5) * 0.45 * jag;
    h = Math.max(0.1, Math.min(1, h));
    const bumpy = Math.sin((i / n) * Math.PI * (1.5 + r())) * 0.35 + 0.65;
    ctx.lineTo(x, base - peak * h * bumpy);
  }
  ctx.lineTo(x1, base + 60);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, base - peak, 0, base + 30);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(240,228,200,0)");
  ctx.fillStyle = g;
  ctx.fill();
}

function pine(ctx: Ctx, x: number, y: number, s: number) {
  ctx.strokeStyle = "rgba(40,32,28,0.85)";
  ctx.lineWidth = 2.2 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + 6 * s, y - 20 * s, x - 8 * s, y - 34 * s, x + 4 * s, y - 52 * s);
  ctx.stroke();
  ctx.fillStyle = "rgba(38,60,48,0.85)";
  for (const [dx, dy, w] of [
    [-10, -28, 18],
    [10, -38, 16],
    [-4, -50, 14],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + dy * s, w * s, 4.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 먹 산수 (병풍용 가로 그림) */
function drawLandscape(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.translate(x, y);
  const silk = ctx.createLinearGradient(0, 0, 0, h);
  silk.addColorStop(0, "#f3e9cf");
  silk.addColorStop(1, "#e6d5ac");
  ctx.fillStyle = silk;
  ctx.fillRect(0, 0, w, h);
  // 붉은 해
  ctx.fillStyle = "rgba(200,70,50,0.9)";
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.2, h * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(180,150,100,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ridge(ctx, 0, w, h * 0.62, h * 0.48, "rgba(110,112,120,0.75)", 3, 1.2);
  ridge(ctx, 0, w, h * 0.72, h * 0.42, "rgba(64,66,74,0.88)", 11, 1.4);
  // 안개 띠
  const mist = ctx.createLinearGradient(0, h * 0.62, 0, h * 0.78);
  mist.addColorStop(0, "rgba(243,233,207,0)");
  mist.addColorStop(0.5, "rgba(243,233,207,0.85)");
  mist.addColorStop(1, "rgba(243,233,207,0)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, h * 0.6, w, h * 0.2);
  ridge(ctx, 0, w * 0.45, h * 0.95, h * 0.35, "rgba(30,31,36,0.95)", 7, 1.6);
  ridge(ctx, w * 0.55, w, h * 0.98, h * 0.3, "rgba(30,31,36,0.92)", 19, 1.6);
  // 소나무, 물 위의 쪽배, 새
  pine(ctx, w * 0.12, h * 0.86, 1.1);
  pine(ctx, w * 0.17, h * 0.88, 0.8);
  pine(ctx, w * 0.86, h * 0.9, 1);
  ctx.fillStyle = "rgba(60,50,40,0.85)";
  ctx.beginPath();
  ctx.ellipse(w * 0.52, h * 0.84, 16, 3.5, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillRect(w * 0.52 - 1, h * 0.84 - 16, 2, 16);
  ctx.strokeStyle = "rgba(60,50,40,0.6)";
  ctx.lineWidth = 1.5;
  for (const [bx, by] of [
    [0.4, 0.22],
    [0.43, 0.19],
    [0.46, 0.23],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(w * bx - 6, h * by);
    ctx.quadraticCurveTo(w * bx, h * by - 5, w * bx + 6, h * by);
    ctx.stroke();
  }
  // 낙관 (붉은 도장)
  ctx.fillStyle = "#b8443a";
  ctx.fillRect(w * 0.93, h * 0.08, 12, 12);
  ctx.restore();
}

/** 세로 글씨 족자 */
function drawScroll(ctx: Ctx, x: number, y: number, w: number, h: number, text: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#3b5a6e";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#f1e6c9";
  ctx.fillRect(w * 0.12, h * 0.08, w * 0.76, h * 0.84);
  ctx.fillStyle = "#1f1a17";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const chars = [...text];
  const step = (h * 0.74) / chars.length;
  ctx.font = `700 ${Math.round(Math.min(w * 0.55, step * 0.85))}px ${SERIF}`;
  chars.forEach((c, i) => {
    ctx.fillText(c, w / 2, h * 0.13 + step * (i + 0.5));
  });
  ctx.fillStyle = "#b8443a";
  ctx.fillRect(w / 2 - 6, h * 0.86, 12, 12);
  ctx.restore();
}

/** 현판: 짙은 나무 바탕에 금박 글씨 (거리 현판과 같은 느낌) */
function drawPlaque(ctx: Ctx, x: number, y: number, w: number, h: number, text: string) {
  ctx.save();
  ctx.translate(x, y);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#4a2b1b");
  bg.addColorStop(1, "#2a170d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#f2d38a";
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.fillStyle = "#f6dc97";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(h * 0.42)}px ${SERIF}`;
  const chars = [...text];
  const step = (w - 80) / chars.length;
  chars.forEach((c, i) => {
    ctx.fillText(c, 40 + step * (i + 0.5), h / 2 + 4);
  });
  ctx.restore();
}

/** 사주판: 네 기둥(시·일·월·년) 여덟 글자 */
function drawSajuBoard(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#f4ead0";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#8a3b2a";
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.lineWidth = 2;
  const cols = ["庚", "甲", "丙", "壬"];
  const rows = ["午", "子", "寅", "辰"];
  const cw = (w - 40) / 4;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(cw * 0.6)}px ${SERIF}`;
  for (let i = 0; i < 4; i++) {
    const cx = 20 + cw * (i + 0.5);
    ctx.strokeRect(20 + cw * i + 4, 24, cw - 8, (h - 48) / 2 - 4);
    ctx.strokeRect(20 + cw * i + 4, 24 + (h - 48) / 2 + 4, cw - 8, (h - 48) / 2 - 4);
    ctx.fillStyle = "#2a1f1a";
    ctx.fillText(cols[i] as string, cx, 24 + (h - 48) / 4);
    ctx.fillStyle = "#8a3b2a";
    ctx.fillText(rows[i] as string, cx, 24 + ((h - 48) * 3) / 4);
  }
  ctx.restore();
}

/** 일월오봉도: 해·달·다섯 봉우리·폭포·소나무·물결 */
function drawIrworobong(ctx: Ctx, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#2f5f8f");
  sky.addColorStop(1, "#5f8fb5");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // 해(오른쪽 붉은)와 달(왼쪽 흰)
  ctx.fillStyle = "#e0453a";
  ctx.beginPath();
  ctx.arc(w * 0.77, h * 0.17, h * 0.085, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f8f3e2";
  ctx.beginPath();
  ctx.arc(w * 0.23, h * 0.17, h * 0.085, 0, Math.PI * 2);
  ctx.fill();
  // 다섯 봉우리 (가운데가 가장 높다)
  const peaks: [number, number, number][] = [
    [0.5, 0.2, 0.2],
    [0.28, 0.33, 0.17],
    [0.72, 0.33, 0.17],
    [0.1, 0.45, 0.14],
    [0.9, 0.45, 0.14],
  ];
  for (const [px, top, half] of [...peaks].reverse()) {
    const g = ctx.createLinearGradient(0, h * top, 0, h * 0.8);
    g.addColorStop(0, "#3f8f6a");
    g.addColorStop(0.55, "#2c6e55");
    g.addColorStop(1, "#1f4f40");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w * (px - half), h * 0.8);
    ctx.bezierCurveTo(
      w * (px - half * 0.55),
      h * (top + 0.25),
      w * (px - half * 0.3),
      h * top,
      w * px,
      h * top,
    );
    ctx.bezierCurveTo(
      w * (px + half * 0.3),
      h * top,
      w * (px + half * 0.55),
      h * (top + 0.25),
      w * (px + half),
      h * 0.8,
    );
    ctx.closePath();
    ctx.fill();
    // 봉우리 꼭대기 흰 띠
    ctx.strokeStyle = "rgba(220,235,220,0.35)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // 폭포 두 줄기
  ctx.fillStyle = "rgba(235,245,255,0.85)";
  ctx.fillRect(w * 0.385, h * 0.5, w * 0.012, h * 0.28);
  ctx.fillRect(w * 0.607, h * 0.5, w * 0.012, h * 0.28);
  // 붉은 줄기 소나무 양쪽
  for (const [px, s] of [
    [0.06, 1],
    [0.94, 1],
    [0.15, 0.8],
    [0.85, 0.8],
  ] as const) {
    ctx.strokeStyle = "#a8443a";
    ctx.lineWidth = 7 * s;
    ctx.beginPath();
    ctx.moveTo(w * px, h * 0.9);
    ctx.lineTo(w * px, h * (0.5 + (1 - s) * 0.2));
    ctx.stroke();
    ctx.fillStyle = "#2f7a4a";
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(
        w * px + (k % 2 ? 14 : -14) * s,
        h * (0.52 + k * 0.08 + (1 - s) * 0.2),
        26 * s,
        9 * s,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  // 물결
  const sea = ctx.createLinearGradient(0, h * 0.78, 0, h);
  sea.addColorStop(0, "#3a74b0");
  sea.addColorStop(1, "#22508a");
  ctx.fillStyle = sea;
  ctx.fillRect(0, h * 0.8, w, h * 0.2);
  ctx.strokeStyle = "rgba(240,248,255,0.85)";
  ctx.lineWidth = 3;
  for (let row = 0; row < 3; row++) {
    const yy = h * (0.84 + row * 0.055);
    for (let x0 = (row % 2) * 24; x0 < w; x0 += 48) {
      ctx.beginPath();
      ctx.arc(x0 + 24, yy, 18, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  }
  // 테두리
  ctx.strokeStyle = "#7a2f25";
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, w - 14, h - 14);
}

/** 사주집 그림 한 장: 위 절반 병풍 산수, 아래 왼쪽 사주판, 그 옆 족자 */
export const SAJU_ATLAS = {
  screen: { u0: 0, v0: 0.5, u1: 1, v1: 1 },
  board: { u0: 0, v0: 0, u1: 0.375, v1: 0.5 },
  scroll: { u0: 0.375, v0: 0, u1: 0.5, v1: 0.5 },
  plaque: { u0: 0.5, v0: 0.25, u1: 1, v1: 0.5 },
};

function canvasTexture(w: number, h: number, draw: (ctx: Ctx) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d") as Ctx;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // 한자 글꼴이 늦게 오면 한 번 다시 그린다
  document.fonts?.load(`700 40px ${SERIF}`).then(() => {
    draw(ctx);
    tex.needsUpdate = true;
  });
  return tex;
}

export function sajuTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 512, (ctx) => {
    drawLandscape(ctx, 0, 0, 1024, 256);
    drawSajuBoard(ctx, 0, 256, 384, 256);
    drawScroll(ctx, 384, 256, 128, 256, "樂天知命");
    drawPlaque(ctx, 512, 256, 512, 128, "四柱命理");
  });
}

export function irworobongTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 512, (ctx) => drawIrworobong(ctx, 1024, 512));
}

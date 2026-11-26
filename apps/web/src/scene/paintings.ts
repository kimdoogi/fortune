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

// ───────────── 아기도령 신당: 무신도 세 폭 (D-086) ─────────────
/** 무신도 한 폭의 사람 모양: 후광 + 얼굴 + 옷 (2등신 톤에 맞춰 단순하게) */
function deity(
  ctx: Ctx,
  cx: number,
  cy: number,
  s: number,
  o: { robe: string; trim: string; hair: string; beard?: boolean; crown?: boolean; knot?: boolean },
) {
  // 후광
  ctx.fillStyle = "rgba(242, 194, 48, 0.55)";
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.95, s * 0.62, 0, Math.PI * 2);
  ctx.fill();
  // 옷 (사다리꼴) + 깃
  ctx.fillStyle = o.robe;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.42, cy - s * 0.45);
  ctx.lineTo(cx + s * 0.42, cy - s * 0.45);
  ctx.lineTo(cx + s * 0.85, cy + s * 0.95);
  ctx.lineTo(cx - s * 0.85, cy + s * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = o.trim;
  ctx.lineWidth = s * 0.09;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.2, cy - s * 0.45);
  ctx.lineTo(cx + s * 0.12, cy + s * 0.35);
  ctx.stroke();
  // 소매 (두 손을 모은 모양)
  ctx.fillStyle = o.trim;
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.25, s * 0.38, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  // 얼굴
  ctx.fillStyle = "#f6d9bd";
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.85, s * 0.38, 0, Math.PI * 2);
  ctx.fill();
  // 머리
  ctx.fillStyle = o.hair;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.95, s * 0.39, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  if (o.knot) {
    ctx.beginPath();
    ctx.arc(cx, cy - s * 1.35, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  if (o.crown) {
    ctx.fillStyle = "#2a1d3a";
    ctx.fillRect(cx - s * 0.2, cy - s * 1.42, s * 0.4, s * 0.18);
    ctx.fillStyle = "#f2c230";
    ctx.fillRect(cx - s * 0.2, cy - s * 1.3, s * 0.4, s * 0.04);
  }
  // 눈 (감은 듯 가는 선) · 입
  ctx.strokeStyle = "#3a2418";
  ctx.lineWidth = s * 0.04;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + side * s * 0.14, cy - s * 0.84, s * 0.06, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  if (o.beard) {
    ctx.fillStyle = "#f4f1ea";
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.24, cy - s * 0.72);
    ctx.quadraticCurveTo(cx, cy - s * 0.05, cx + s * 0.24, cy - s * 0.72);
    ctx.fill();
    // 흰 눈썹
    ctx.strokeStyle = "#f4f1ea";
    ctx.lineWidth = s * 0.07;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * s * 0.06, cy - s * 0.97);
      ctx.lineTo(cx + side * s * 0.26, cy - s * 0.93);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#c0505a";
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.7, s * 0.05, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 140, 150, 0.6)";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * s * 0.22, cy - s * 0.74, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** 호랑이 (산신 옆에 엎드린) */
function tiger(ctx: Ctx, x: number, y: number, s: number) {
  ctx.fillStyle = "#e88a2a";
  ctx.beginPath();
  ctx.ellipse(x, y, s, s * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - s * 0.95, y - s * 0.2, s * 0.36, 0, Math.PI * 2);
  ctx.fill();
  for (const dx of [-0.2, 0.2]) {
    ctx.beginPath();
    ctx.arc(x - s * 0.95 + dx * s, y - s * 0.52, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#2a1a10";
  ctx.lineWidth = s * 0.07;
  for (let i = 0; i < 5; i++) {
    const sx = x - s * 0.5 + i * s * 0.3;
    ctx.beginPath();
    ctx.moveTo(sx, y - s * 0.34);
    ctx.quadraticCurveTo(sx + s * 0.08, y - s * 0.1, sx - s * 0.02, y + s * 0.05);
    ctx.stroke();
  }
  ctx.fillStyle = "#2a1a10";
  for (const dx of [-0.12, 0.12]) {
    ctx.beginPath();
    ctx.arc(x - s * 0.95 + dx * s, y - s * 0.24, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
  // 꼬리
  ctx.strokeStyle = "#e88a2a";
  ctx.lineWidth = s * 0.12;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.95, y);
  ctx.quadraticCurveTo(x + s * 1.3, y - s * 0.2, x + s * 1.1, y - s * 0.55);
  ctx.stroke();
}

function musindoPanel(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  draw: (cx: number, cy: number) => void,
) {
  ctx.save();
  ctx.translate(x, y);
  // 비단 테두리
  ctx.fillStyle = "#6a1a14";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#b8902a";
  ctx.fillRect(w * 0.05, h * 0.03, w * 0.9, h * 0.94);
  // 그림 바탕 (오래된 비단)
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#a88a5c");
  bg.addColorStop(1, "#6e5432");
  ctx.fillStyle = bg;
  ctx.fillRect(w * 0.07, h * 0.045, w * 0.86, h * 0.91);
  // 붉은 구름 띠 (위)
  ctx.fillStyle = "rgba(180, 50, 40, 0.35)";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(w * (0.2 + i * 0.2), h * 0.12, w * 0.12, h * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  draw(w / 2, h * 0.58);
  // 제목 (붉은 바탕 금 글씨)
  ctx.fillStyle = "#8f2a22";
  ctx.fillRect(w * 0.32, h * 0.06, w * 0.36, h * 0.1);
  ctx.fillStyle = "#f6dc97";
  ctx.font = `700 ${Math.round(h * 0.07)}px ${SERIF}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, w / 2, h * 0.112);
  ctx.restore();
}

function drawMusindo(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = "#3a1410";
  ctx.fillRect(0, 0, w, h);
  const pw = w * 0.3;
  const gap = (w - pw * 3) / 4;
  // 왼쪽: 동자신 (복숭아를 든 아이)
  musindoPanel(ctx, gap, h * 0.04, pw, h * 0.92, "童子", (cx, cy) => {
    deity(ctx, cx, cy, h * 0.16, {
      robe: "#3c6fd6",
      trim: "#f6c84a",
      hair: "#1f1612",
      knot: true,
    });
    ctx.fillStyle = "#f28fb0";
    ctx.beginPath();
    ctx.arc(cx, cy + h * 0.02, h * 0.035, 0, Math.PI * 2);
    ctx.fill();
  });
  // 가운데: 산신령과 호랑이, 소나무
  musindoPanel(ctx, gap * 2 + pw, h * 0.04, pw, h * 0.92, "山神", (cx, cy) => {
    ctx.fillStyle = "#2f5a3a";
    ctx.beginPath();
    ctx.moveTo(cx - pw * 0.42, cy - h * 0.18);
    ctx.lineTo(cx - pw * 0.28, cy - h * 0.34);
    ctx.lineTo(cx - pw * 0.16, cy - h * 0.18);
    ctx.fill();
    ctx.fillRect(cx - pw * 0.3, cy - h * 0.18, pw * 0.03, h * 0.3);
    deity(ctx, cx + pw * 0.04, cy - h * 0.02, h * 0.15, {
      robe: "#c0392b",
      trim: "#2f58bd",
      hair: "#e8e4da",
      beard: true,
    });
    tiger(ctx, cx + pw * 0.06, cy + h * 0.24, h * 0.09);
  });
  // 오른쪽: 선녀(대신 할머니) — 족두리와 흰 옷
  musindoPanel(ctx, gap * 3 + pw * 2, h * 0.04, pw, h * 0.92, "仙女", (cx, cy) => {
    deity(ctx, cx, cy, h * 0.16, {
      robe: "#f4f1ea",
      trim: "#d9413a",
      hair: "#1f1612",
      crown: true,
    });
  });
}

/**
 * 무신도 텍스처 (D-086). 먼저 코드로 그린 그림을 보여 주고, 탱화풍 이미지(AI 생성, public/textures)를
 * 받으면 같은 캔버스에 덮어 그린다. 이미지를 못 받으면 코드 그림이 그대로 남는다.
 */
export function musindoTexture(url = "/textures/musindo.jpg"): THREE.CanvasTexture {
  let photo: HTMLImageElement | null = null;
  const draw = (ctx: Ctx) => {
    if (photo) ctx.drawImage(photo, 0, 0, 1024, 512);
    else drawMusindo(ctx, 1024, 512);
  };
  const tex = canvasTexture(1024, 512, draw);
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    photo = img;
    const canvas = tex.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    draw(ctx);
    tex.needsUpdate = true;
  };
  img.src = url;
  return tex;
}

// ───────────── 족집게집: 관상 족자 + 현판 (D-100) ─────────────
/** 관상 그림: 먹 선으로 그린 얼굴과 삼정(上停·中停·下停) 나눔 선, 점 자리 */
function drawGwansang(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.translate(x, y);
  // 비단 테두리 + 누런 종이
  ctx.fillStyle = "#6a3a2a";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#c9a86a";
  ctx.fillRect(w * 0.06, h * 0.035, w * 0.88, h * 0.93);
  const paper = ctx.createLinearGradient(0, 0, 0, h);
  paper.addColorStop(0, "#f1e4c4");
  paper.addColorStop(1, "#e2cfa4");
  ctx.fillStyle = paper;
  ctx.fillRect(w * 0.09, h * 0.045, w * 0.82, h * 0.91);
  // 제목
  ctx.fillStyle = "#1f1a17";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(w * 0.16)}px ${SERIF}`;
  ctx.fillText("觀相", w / 2, h * 0.1);
  // 얼굴
  const cx = w / 2;
  const cy = h * 0.47;
  const fw = w * 0.27;
  const fh = h * 0.27;
  ctx.strokeStyle = "rgba(30,24,20,0.9)";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(cx, cy, fw, fh, 0, 0, Math.PI * 2);
  ctx.stroke();
  // 귀
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * fw * 1.02, cy - fh * 0.02, fw * 0.14, fh * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 머리선
  ctx.beginPath();
  ctx.moveTo(cx - fw * 0.92, cy - fh * 0.45);
  ctx.quadraticCurveTo(cx, cy - fh * 0.78, cx + fw * 0.92, cy - fh * 0.45);
  ctx.stroke();
  // 눈썹·눈
  ctx.lineWidth = 2;
  for (const s of [-1, 1]) {
    const ex = cx + s * fw * 0.42;
    ctx.beginPath();
    ctx.moveTo(ex - s * fw * 0.22, cy - fh * 0.2);
    ctx.quadraticCurveTo(ex, cy - fh * 0.32, ex + s * fw * 0.24, cy - fh * 0.22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex - fw * 0.18, cy - fh * 0.06);
    ctx.quadraticCurveTo(ex, cy - fh * 0.16, ex + fw * 0.18, cy - fh * 0.06);
    ctx.quadraticCurveTo(ex, cy + fh * 0.02, ex - fw * 0.18, cy - fh * 0.06);
    ctx.stroke();
    ctx.fillStyle = "rgba(30,24,20,0.9)";
    ctx.beginPath();
    ctx.arc(ex, cy - fh * 0.07, fw * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  // 코·인중·입
  ctx.beginPath();
  ctx.moveTo(cx - fw * 0.04, cy - fh * 0.08);
  ctx.lineTo(cx - fw * 0.1, cy + fh * 0.22);
  ctx.quadraticCurveTo(cx, cy + fh * 0.3, cx + fw * 0.12, cy + fh * 0.22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy + fh * 0.32);
  ctx.lineTo(cx, cy + fh * 0.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - fw * 0.26, cy + fh * 0.48);
  ctx.quadraticCurveTo(cx, cy + fh * 0.58, cx + fw * 0.26, cy + fh * 0.48);
  ctx.stroke();
  // 삼정 나눔 선 (붉은 점선) + 옆 글씨
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "rgba(168,48,40,0.85)";
  ctx.lineWidth = 1.6;
  const lines = [cy - fh * 0.62, cy - fh * 0.2, cy + fh * 0.3, cy + fh * 0.98];
  for (const ly of lines) {
    ctx.beginPath();
    ctx.moveTo(cx - fw * 1.35, ly);
    ctx.lineTo(cx + fw * 1.35, ly);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "#a83028";
  ctx.font = `700 ${Math.round(w * 0.08)}px ${SERIF}`;
  ["上", "中", "下"].forEach((c, i) => {
    const a = lines[i] as number;
    const b = lines[i + 1] as number;
    ctx.fillText(c, cx - fw * 1.5, (a + b) / 2);
    ctx.fillText(["天", "人", "地"][i] as string, cx + fw * 1.5, (a + b) / 2);
  });
  // 점 자리 (작은 붉은 원)
  for (const [dx, dy] of [
    [-0.5, -0.45],
    [0.55, 0.1],
    [-0.2, 0.36],
    [0.3, 0.7],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx + dx * fw, cy + dy * fh, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // 아래 설명 줄 (흐린 먹 글씨 자리)
  ctx.fillStyle = "rgba(40,32,28,0.5)";
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(w * 0.2, h * (0.82 + i * 0.028), w * (0.6 - (i % 2) * 0.12), 2.2);
  }
  // 낙관
  ctx.fillStyle = "#b8443a";
  ctx.fillRect(w * 0.66, h * 0.92 - 6, 13, 13);
  ctx.restore();
}

/** 족집게집 그림 한 장: 왼쪽 관상 족자, 오른쪽 위 현판 */
export const JOKJIPGE_ATLAS = {
  scroll: { u0: 0, v0: 0, u1: 0.5, v1: 1 },
  plaque: { u0: 0.5, v0: 0.75, u1: 1, v1: 1 },
};

export function jokjipgeTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    drawGwansang(ctx, 0, 0, 256, 512);
    drawPlaque(ctx, 256, 0, 256, 128, "족집게");
  });
}

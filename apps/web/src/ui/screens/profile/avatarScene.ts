/**
 * 캐릭터 미리보기 (F02 3단계: 기본 아바타가 등장해 인사한다).
 * 작은 캔버스 하나에 2등신 캐릭터만 그린다. three.js가 들어 있어서 이 파일은 동적 import로만 부른다 (07 §2).
 */
import * as THREE from "three";
import { Chibi, type ChibiLook } from "../../../scene/chibi";

export interface AvatarView {
  /** 손 흔들기 한 번 */
  wave(): void;
  /** 꾸미기를 바꾸면 캐릭터만 갈아 끼운다 (렌더러는 그대로, F17) */
  setLook(look: ChibiLook): void;
  dispose(): void;
}

/** 등불 빛 웅덩이: 가운데가 밝은 원. 작은 그라데이션을 한 번만 래스터화한다 (07 §4) */
function glowDisc(radius: number, color: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, `${color}88`);
    grad.addColorStop(1, `${color}00`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function mountAvatar(canvas: HTMLCanvasElement, look: ChibiLook): AvatarView {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  // 토끼 귀·갓·족두리까지 들어오게 조금 물러서 본다 (F17)
  camera.position.set(0, 0.98, 3.1);
  camera.lookAt(0, 0.68, 0);

  // 거리와 같은 조명: 차가운 달빛 + 따뜻한 등불 채움빛 (D-065)
  scene.add(new THREE.HemisphereLight("#a3a8e6", "#3d2c26", 1.4));
  const moon = new THREE.DirectionalLight("#c9d0ff", 0.85);
  moon.position.set(-5, 9, 8);
  const warm = new THREE.DirectionalLight("#ffc890", 0.75);
  warm.position.set(4, 3, 7);
  scene.add(moon, warm);

  // 둥근 디딤돌 + 불빛 웅덩이
  const stoneGeo = new THREE.CylinderGeometry(0.62, 0.7, 0.12, 28);
  const stoneMat = new THREE.MeshLambertMaterial({ color: "#8d877c" });
  const stone = new THREE.Mesh(stoneGeo, stoneMat);
  stone.position.y = -0.06;
  const glow = glowDisc(1.0, "#ffb85c");
  glow.position.y = 0.005;
  scene.add(stone, glow);

  let chibi = new Chibi(look).compact();
  scene.add(chibi.root);
  // 팔은 Chibi 안쪽 값이라 직접 흔든다 (손 흔들기 동작이 따로 없을 때)
  const armsOf = (c: Chibi) => (c as unknown as { arms?: THREE.Object3D[] }).arms;
  let arms = armsOf(chibi);

  const resize = () => {
    const w = canvas.clientWidth || 240;
    const h = canvas.clientHeight || 240;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const clock = new THREE.Clock();
  let t = 0;
  let waveAt = 0.55; // 등장 직후 한 번 흔든다
  /** 꾸미기를 바꾼 때 (살짝 통 튄다) */
  let popAt = -1;
  let raf = 0;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);
    t += dt;
    chibi.update(dt, false);

    // 등장: 작게 튀어나와 통 하고 선다
    const e = Math.min(t / 0.55, 1);
    const back = 1 + 2.2 * (e - 1) ** 3 + 1.2 * (e - 1) ** 2;
    chibi.root.scale.setScalar(reduce ? 1 : Math.max(0.01, back));
    const pop = t - popAt < 0.3 ? Math.sin(((t - popAt) / 0.3) * Math.PI) * 0.08 : 0;
    chibi.root.position.y = reduce ? 0 : Math.sin(Math.min(t / 0.55, 1) * Math.PI) * 0.18 + pop;
    chibi.root.rotation.y = reduce ? 0 : Math.sin(t * 0.7) * 0.22;

    // 손 흔들기 (1.8초). 6초마다 다시
    const w = t - waveAt;
    const arm = arms?.[1];
    if (arm) {
      if (w >= 0 && w < 1.8) {
        const k = Math.min(w / 0.25, 1, (1.8 - w) / 0.25);
        arm.rotation.z = 0.32 + k * (2.2 + Math.sin(w * 13) * 0.35);
      } else arm.rotation.z = 0.32;
    }
    if (w > 6) waveAt = t;

    renderer.render(scene, camera);
  };
  loop();

  return {
    wave() {
      if (t - waveAt > 1.8) waveAt = t;
    },
    setLook(next) {
      scene.remove(chibi.root);
      chibi.dispose();
      chibi = new Chibi(next).compact();
      arms = armsOf(chibi);
      scene.add(chibi.root);
      // 바뀐 걸 알 수 있게 살짝 통 튄다
      popAt = t;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stoneGeo.dispose();
      stoneMat.dispose();
      glow.geometry.dispose();
      (glow.material as THREE.MeshBasicMaterial).map?.dispose();
      (glow.material as THREE.Material).dispose();
      // 공유 지오메트리·재질은 남기고, 이 캐릭터만의 것(합친 메시·색 재질)만 지운다 (07 §5)
      chibi.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

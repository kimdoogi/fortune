/**
 * 화면 크기·방향 처리 (07 §1).
 * - 가로 화면 안내는 "기기가 실제로 가로인지"로만 정한다. 안드로이드는 키보드가 올라오면 보이는 높이가 줄어
 *   화면비로 판단하면 세로로 들고 있어도 가로로 오판한다 (2026-11-25 사용자 제보).
 * - 앱 높이(--app-h)를 키보드 위에 보이는 높이(visualViewport)에 맞춰, 아래쪽 입력칸이 키보드 위로 올라오게 한다.
 * - 입력칸을 누르면 화면 가운데로 끌어온다 (아이폰처럼 화면이 줄지 않는 브라우저 대비).
 */

const isTyping = () => {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el as HTMLElement | null)?.isContentEditable === true
  );
};

/** 기기 방향. 키보드로 보이는 높이가 줄어도 바뀌지 않는 값만 쓴다 */
export function deviceIsLandscape(): boolean {
  const type = screen.orientation?.type;
  if (type) return type.startsWith("landscape");
  // 옛 iOS: window.orientation (90 / -90 = 가로)
  const legacy = (window as unknown as { orientation?: number }).orientation;
  if (typeof legacy === "number") return Math.abs(legacy) === 90;
  return window.screen.width > window.screen.height;
}

export function installViewport(): void {
  const root = document.documentElement;
  const vv = window.visualViewport;
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  const apply = () => {
    const h = vv ? vv.height : window.innerHeight;
    root.style.setProperty("--app-h", `${Math.round(h)}px`);
    // 휴대폰을 진짜 가로로 돌렸을 때만, 그리고 글자를 쓰는 중이 아닐 때만 안내한다
    root.classList.toggle("is-landscape", coarse && deviceIsLandscape() && !isTyping());
  };

  apply();
  vv?.addEventListener("resize", apply);
  window.addEventListener("resize", apply);
  screen.orientation?.addEventListener?.("change", apply);
  window.addEventListener("orientationchange", apply);
  document.addEventListener("focusout", () => setTimeout(apply, 50));

  // 입력칸을 누르면 키보드가 다 올라온 뒤 화면 가운데로 끌어온다
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    apply();
    setTimeout(() => {
      if (document.activeElement === el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 320);
  });
}

/**
 * 웹 앱 진입점. 첫 화면(지도)에는 three.js를 넣지 않는다 (07 §2). 3D는 지도가 뜬 뒤 따로 받는다.
 * 주소 파라미터: ?debug=1 (FPS·드로우콜 표시, 07 §6), ?mock=1 (개발용 가짜 API)
 */
import { render } from "preact";
import { api } from "./api/client";
import { App } from "./ui/app/App";
import "./ui/styles.css";

async function start() {
  // 개발 서버에서만: 서버 없이 화면을 볼 수 있게 api 객체의 함수를 가짜로 바꾼다 (배포 빌드에서는 빠짐)
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("mock")) {
    const { mockApi } = await import("./ui/app/mock");
    Object.assign(api, mockApi);
  }
  const root = document.getElementById("app");
  if (root) render(<App />, root);
}

void start();

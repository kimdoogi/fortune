/**
 * 장면 실험실 (개발용, scene-lab.html). 배포 묶음에는 들어가지 않는다 (vite build 입력은 index.html뿐).
 * 주소 파라미터: ?shop=saju|tarot|dolyeong|dream &inside=1 &act=greet &ui=1(대사 상자 자리 표시)
 *   &gender=female|male &age=20대
 */
import type { ShopId } from "@fortune/shared-types";
import type { AgeBand, Gender } from "./chibi";
import { NPC_NAMES } from "./npc-looks";
import { type NpcAction, Stage } from "./stage";

const params = new URLSearchParams(location.search);
const SHOPS: ShopId[] = ["saju", "tarot", "dolyeong", "dream"];
const shop = (SHOPS.find((s) => s === params.get("shop")) ?? "saju") as ShopId;
const gender: Gender = params.get("gender") === "male" ? "male" : "female";
const AGES: AgeBand[] = ["10대", "20대", "30대", "40대 이상"];
const ageBand = AGES.find((a) => a === params.get("age")) ?? "20대";
if (params.get("ui") === "1") document.body.classList.add("ui");

const canvas = document.getElementById("c") as HTMLCanvasElement;
const statsEl = document.getElementById("stats") as HTMLDivElement;
const panel = document.getElementById("panel") as HTMLDivElement;

let near = false;
let last = { fps: 0, calls: 0, triangles: 0 };
const stage = new Stage(
  canvas,
  { shop, look: { gender, ageBand } },
  {
    onNearDoor: (v) => {
      near = v;
      show();
    },
    onFirstMove: () => console.info("[lab] first move"),
    onStats: (s) => {
      last = s;
      show();
    },
  },
);
(window as unknown as { stage: Stage }).stage = stage;

function show() {
  statsEl.textContent =
    `${NPC_NAMES[shop]} · ${stage.inside ? "내부" : "거리"}${near ? " · 문 앞" : ""}\n` +
    `FPS ${last.fps} · draw ${last.calls} · tri ${last.triangles.toLocaleString()}\n` +
    `build ${stage.lastBuildMs.toFixed(0)}ms · shader ${stage.lastCompileMs.toFixed(0)}ms`;
}

function button(label: string, onClick: () => void) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.onclick = onClick;
  panel.append(b);
}

const select = document.createElement("select");
for (const s of SHOPS) {
  const o = document.createElement("option");
  o.value = s;
  o.textContent = NPC_NAMES[s];
  o.selected = s === shop;
  select.append(o);
}
select.onchange = () => {
  params.set("shop", select.value);
  location.search = params.toString();
};
panel.append(select);

button("들어가기", () => {
  stage
    .enterShop()
    .then(() => {
      show();
      stage.npc("greet");
    })
    .catch((e) => console.error("[lab] enter failed", e));
});
button("나가기", () => {
  stage.exitShop();
  show();
});
for (const a of ["idle", "greet", "talk", "present", "celebrate"] as NpcAction[])
  button(a, () => stage.npc(a));
button("UI 자리", () => document.body.classList.toggle("ui"));

if (params.get("inside") === "1") {
  stage.enterShop().then(() => {
    show();
    const act = params.get("act") as NpcAction | null;
    stage.npc(act ?? "greet");
  });
}

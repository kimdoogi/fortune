import { allTypeMatches } from "@fortune/fortune-engine/src/types60";
/**
 * 개발용 가짜 API (`?mock=1`). 서버 없이 화면을 확인할 때 쓴다. 배포 빌드에는 들어가지 않는다.
 * `?mock=fresh` 는 첫 방문(프로필 없음)부터, `&mockerr=llm` 은 오늘의 운세 실패를 흉내 낸다.
 */
import {
  DISCLAIMER,
  type DailyResponse,
  type ErrorCode,
  type InterpretOutput,
  PRODUCT_NAMES,
  type ProductId,
  type ProfileInput,
  type ProfileView,
  type ReadingListItem,
  type ReadingRequest,
  type ReadingResult,
  type ReadingVisual,
  SHOP_PRODUCTS,
  type ShopId,
  avatarString,
} from "@fortune/shared-types";
import { ApiFailure, type api } from "../../api/client";
import { NATURE_BOARD, NATURE_SAMPLE } from "../shop/labData";

type Api = typeof api;
const KEY = "fortune.mock.v1";
const params = new URLSearchParams(location.search);
const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms + Math.random() * 250));
const fail = (code: ErrorCode, message: string, status = 400) =>
  new ApiFailure(code, message, status);

interface Db {
  profile: ProfileView | null;
  readings: ReadingResult[];
  calls: number;
}

const STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const ELEMENTS = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"];
const ZODIAC = ["원숭이", "닭", "개", "돼지", "쥐", "소", "범", "토끼", "용", "뱀", "말", "양"];

const SAMPLE_PROFILE: ProfileView = {
  nickname: "달빛나그네",
  calendar: "solar",
  birthDate: "1996-04-17",
  isLeapMonth: false,
  birthTime: { kind: "branch", branch: "진" },
  gender: "female",
  ageBand: "20대",
  avatarId: "female:20대",
  style: null,
  dayMaster: { stem: "병", element: "화", yinYang: "양" },
  zodiac: "쥐",
  flags: { ambiguousTime: false, solarTermDay: false },
};

function ageOf(birth: string) {
  const [y, m, d] = birth.split("-").map(Number) as [number, number, number];
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}

function makeProfile(input: ProfileInput): ProfileView {
  const [y, m, d] = input.birthDate.split("-").map(Number) as [number, number, number];
  const real = new Date(y, m - 1, d);
  if (input.calendar === "solar" && (real.getMonth() !== m - 1 || real.getDate() !== d))
    throw fail("INVALID_DATE", "없는 날짜예요. 다시 확인해 주세요");
  if (y < 1920) throw fail("OUT_OF_RANGE", "1920년 1월 1일 이후로 태어난 날만 볼 수 있어요");
  if (input.calendar === "lunar" && input.isLeapMonth && m !== 4)
    throw fail("NO_SUCH_LEAP_MONTH", `그 해에는 윤${m}월이 없어요`);
  if (
    input.birthTime.kind === "clock" &&
    y === 1988 &&
    m === 5 &&
    d === 8 &&
    input.birthTime.hour === 2
  )
    throw fail("NONEXISTENT_TIME", "그 시각은 서머타임으로 건너뛴 시간이에요. 다시 확인해 주세요");
  const age = ageOf(input.birthDate);
  if (age < 14) throw fail("UNDER_14", "만 14세 이상부터 이용할 수 있어요", 403);
  const ageBand = age < 20 ? "10대" : age < 30 ? "20대" : age < 40 ? "30대" : "40대 이상";
  const stem = STEMS[(d + m) % 10] ?? "갑";
  const { consent: _, ...rest } = input;
  return {
    ...rest,
    ageBand,
    avatarId: `${input.gender}:${ageBand}`,
    style: null,
    dayMaster: {
      stem,
      element: ELEMENTS[STEMS.indexOf(stem)] ?? "목",
      yinYang: STEMS.indexOf(stem) % 2 === 0 ? "양" : "음",
    },
    zodiac: ZODIAC[y % 12] ?? "쥐",
    flags: {
      // 1987~88 서머타임 끝나는 날 새벽 같은 경우를 흉내 낸다
      ambiguousTime: input.birthTime.kind === "clock" && m === 10 && d === 9,
      solarTermDay: input.birthTime.kind === "unknown" && d === 4,
    },
  };
}

const OUT: Record<ProductId, InterpretOutput> = {
  nature: NATURE_SAMPLE,
  gunghap: {
    greeting: "두 분, 나란히 앉으니 보기 좋구려.",
    summary: "준호 님과 궁합 · 서로 키워 주는 사이",
    sections: {
      overall:
        "두 분은 한쪽이 밀어 주면 다른 쪽이 자라는 짝이오. 처음 만났을 때부터 묘하게 편했을 것이오. 다만 띠끼리 서운함이 쌓이기 쉬우니, 작은 섭섭함을 그날그날 말로 풀어야 하오.",
      chemistry:
        "하나 님은 물처럼 흐르며 살피고, 준호 님은 나무처럼 곧게 뻗어 나가오. 하나 님이 마음을 채워 주면 준호 님이 앞장서는 모양이구려.",
      strengths:
        "함께 계획을 세우면 금방 실행으로 옮기오. 서로 모자란 걸 먼저 알아채고 챙겨 주는 사이요.",
      friction:
        "답장이 늦거나 약속을 바꿀 때 괜히 서운한 마음이 쌓이기 쉽소. 바쁜 주에는 한 사람만 계속 맞추다 지치기도 하오.",
      tips: "한 달에 한 번 둘만의 산책 날을 잡으시오. 섭섭한 일은 메시지보다 통화로 푸는 게 좋소.",
    },
    advice: "서로 고마운 걸 한 가지씩 말해 보시오.",
  },
  tarot_pair: {
    greeting: "두 분, 나란히 앉으시니 카드도 설레나 봐요.",
    summary: "준호 님과 관계 타로 · 마음은 같은 쪽",
    sections: {
      hearts:
        "하나 님 자리에는 별 카드가 떴어요. 요즘 하나 님은 이 관계에 조용히 기대를 걸고 계세요. 준호 님 자리의 달 카드는 역방향이라, 마음은 있는데 표현이 서툴러 오해가 생기기 쉬운 때예요. 두 분 다 같은 쪽을 보고 있지만, 말로 꺼내는 속도가 달라요.",
      future:
        "두 사람의 앞날에는 태양 카드가 나왔어요. 다음 달쯤 같이 웃을 일이 하나 생겨요. 다만 그 전에 한 번은 서로 서운한 얘기를 꺼내야 길이 열려요.",
      advice:
        "이번 주에 둘이 같이 산책 한 번 해 보세요. 하나 님은 기다리기보다 먼저 묻고, 준호 님은 대답을 미루지 않으면 좋아요.",
    },
    advice: "말 한마디가 카드 세 장보다 빨라요.",
  },
  sinjeom_pair: {
    greeting: "딸랑딸랑!",
    summary: "준호랑 둘의 신점 · 쌀 7알",
    sections: {
      gongsu:
        "쌀이 일곱 알! 제일 좋은 수야!\n요즘 둘이 같이 밥 먹다 크게 웃은 적 있지?\n할아버지가 둘이 손잡고 가면 봄에 좋은 일 온대.\n같이 사진 한 장 찍고, 말 끊는 건 조심해!",
    },
    advice: "오늘 둘이 맛있는 거 먹어!",
  },
  dream_pair: {
    greeting: "아이고, 둘이 같이 왔구먼.",
    summary: "준호랑 꿈풀이 · 물과 날개",
    sections: {
      dreams:
        "하나는 맑은 냇가에서 물고기를 잡았지. 물고기는 들어오는 복이고 맑은 물은 마음이 편하다는 뜻이야. 준호는 하늘을 나는 꿈을 꿨구먼. 나는 꿈은 답답한 데서 벗어나고 싶다는 마음이야.",
      meaning:
        "둘 꿈을 이어 보면 하나는 붙잡고 싶고 준호는 훌쩍 떠나고 싶은 때야. 같은 쪽을 보는데 속도가 달라. 그래서 요즘 작은 일로 서운함이 생기기 쉬워. 그래도 둘 다 좋은 기운이라 크게 걱정할 건 없어.",
      advice: "이번 주말에 둘이 물가로 바람 쐬러 가 봐. 하나는 붙잡고, 준호는 날고, 딱 좋아.",
    },
    advice: "꿈은 꿈이고, 오늘은 둘이 같이 웃어.",
  },
  daily: {
    greeting: "어서 오시오, 오늘 하루를 같이 살펴봅시다.",
    summary: "작은 정성이 큰 인연으로 이어지는 날이오.",
    sections: {
      overall:
        "오늘은 불의 기운이 그대의 일간을 북돋우니, 마음먹은 일을 시작하기에 좋은 날이구려. 다만 서두르면 말이 앞서기 쉬우니, 한 번 더 듣고 한 번 덜 말하는 것이 이롭소. 오후에는 오래 연락이 없던 이에게서 반가운 소식이 올 수 있으니 귀를 열어 두시오.",
      tip: "아침에 따뜻한 차 한 잔을 마시며 오늘 할 일 세 가지만 적어 보시오.",
    },
    advice: "서두르지 말고, 한 걸음씩 가면 길이 열리오.",
    luckyColor: "연두색",
  },
  saju_full: {
    greeting: "그대의 사주판을 펼쳐 보았소.",
    summary: "따뜻한 불이 나무를 만나 크게 자라는 사주요.",
    sections: {
      overall: "그대는 한여름 햇살 같은 병화 일간이오. 곁에 있는 이를 환하게 비추는 힘이 있구려.",
      personality: "솔직하고 정이 많으나, 마음이 급할 때가 있소. 숨을 고르면 더 멀리 가오.",
      elements: "목과 화가 넉넉하고 금이 조금 약하오. 정리하고 매듭짓는 일을 곁에 두면 좋소.",
      yongsin: "용신은 수요. 차분히 생각을 식히는 물의 기운이 그대를 돕는다는 뜻이오.",
      daewoon: "지금 지나는 대운은 배움과 인연이 함께 들어오는 흐름이오.",
      thisYear: "올해는 씨앗을 심는 해요. 결과보다 꾸준함을 보시오.",
      months:
        "◎ 12월 — [mock] 윗사람 추천으로 일이 커지오. 연말 모임에 빠지지 마시오.\n△ 2027년 2월 — [mock] 계약서 문구를 꼭 두 번 읽으시오.\n◎ 2027년 5월 — [mock] 자격증 공부가 결실을 보오.\n△ 2027년 6월 — [mock] 가까운 사람과 말다툼을 조심하시오.",
      love: "먼저 다가가는 따뜻함이 좋은 인연을 부르오.",
      money: "새는 돈을 막으면 쌓이는 해요. 작은 장부를 써 보시오.",
      work: "맡은 일을 끝까지 마무리하는 모습이 눈에 띄는 때요.",
    },
    advice: "그대의 빛은 서두르지 않을 때 가장 밝소.",
    luckyColor: "남색",
  },
  tarot_one: {
    greeting: "어서 와요, 오늘의 카드를 같이 볼까요?",
    summary: "별 카드가 조용한 희망을 비춰 주고 있어요.",
    sections: {
      card: "별 카드는 긴 밤 끝에 뜨는 별처럼, 지친 마음에 다시 희망이 차오르는 걸 뜻해요.",
      message: "오늘은 조급해하지 않아도 괜찮아요. 천천히 내 속도를 믿어 봐요.",
    },
    advice: "작은 바람 하나를 적어 두면 오늘이 조금 더 반짝일 거예요.",
    luckyColor: "하늘색",
  },
  tarot_three: {
    greeting: "세 장의 카드가 이야기를 들려줄 거예요.",
    summary: "망설임을 지나 새로운 시작으로 가는 흐름이에요.",
    sections: {
      past: "지난날의 은둔자 카드는 혼자 오래 고민해 온 시간을 보여줘요.",
      present: "지금의 운명의 수레바퀴는 흐름이 바뀌기 시작했다는 신호예요.",
      future: "앞으로의 태양 카드는 밝고 솔직한 마음이 좋은 결과로 이어진다는 뜻이에요.",
      advice: "결과를 미리 걱정하기보다 오늘 한 걸음을 내딛어 봐요.",
    },
    advice: "마음이 가는 쪽으로, 가볍게 시작해 봐요.",
    luckyColor: "노란색",
  },
  sinjeom: {
    greeting: "딸랑딸랑!",
    summary: "요즘 친구 사이 고민",
    sections: {
      gongsu:
        "[mock] 아홉 알이다! 할아버지가 좋은 수래!\n너 요즘 친구한테 서운한 거 꾹 참았지?!\n다음 주에 먼저 연락 와. 금방 풀린대!\n오늘 먼저 웃으면서 인사해. 말은 짧게!",
    },
    advice: "오늘 먼저 웃으면서 인사해 봐!",
  },
  obanggi: {
    greeting: "왔구나! 깃발 뽑았어!",
    summary: "노랑 깃발! 재물운이 반짝이는 날이야!",
    sections: {
      flag: "노랑은 가운데 땅의 색이야. 든든하게 모이는 기운이래!",
      message: "요즘 아끼던 마음이 보답받을 거야. 근데 충동구매는 조심해!",
      advice: "오늘은 지갑 정리 한 번 해 봐!",
    },
    advice: "웃으면 복이 와! 진짜야!",
    luckyColor: "노란색",
  },
  dream: {
    greeting: "아이고 아가, 재밌는 꿈을 꿨구먼.",
    summary: "물고기 꿈은 넉넉한 복이 들어온다는 뜻이여.",
    sections: {
      symbols: "맑은 냇물에서 큰 물고기를 잡았다 했지? 물은 마음이고, 물고기는 들어오는 복이여.",
      meaning:
        "요새 애쓴 일이 열매를 맺으려고 하는 꿈이구먼. 마음이 맑으니 좋은 게 잘 보이는 거여.",
    },
    advice: "따뜻한 밥 잘 챙겨 먹고, 좋은 일은 조용히 기다려 봐.",
  },
};

const BOARD: ReadingVisual = {
  shop: "saju",
  board: {
    pillars: { year: "병자", month: "임진", day: "병오", hour: "임진" },
    hourUnknown: false,
    dayMaster: { stem: "병", element: "화", yinYang: "양" },
    elements: { 목: 1, 화: 3, 토: 2, 금: 0, 수: 2 },
    strength: "신강",
    yongsin: "수",
    months: [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((month, i) => ({
      year: month >= 11 ? 2026 : 2027,
      month,
      grade: ([1, 6, 9].includes(i) ? "good" : [3, 7].includes(i) ? "caution" : "normal") as
        | "good"
        | "normal"
        | "caution",
    })),
  },
};

function visualFor(req: ReadingRequest): ReadingVisual {
  switch (req.shop) {
    case "saju":
      return BOARD;
    case "tarot":
      return req.product === "tarot_one"
        ? {
            shop: "tarot",
            spread: "one",
            category: req.category,
            cards: [{ position: "오늘", id: 17, name: "별", reversed: false }],
          }
        : {
            shop: "tarot",
            spread: "three",
            category: req.category,
            cards: [
              { position: "과거", id: 9, name: "은둔자", reversed: false },
              { position: "현재", id: 10, name: "운명의 수레바퀴", reversed: true },
              { position: "미래", id: 19, name: "태양", reversed: false },
            ],
          };
    case "dolyeong":
      return req.product === "sinjeom"
        ? {
            shop: "dolyeong",
            category: null,
            flag: { color: "노랑", grade: "길" },
            mode: "sinjeom",
            rice: { count: 9, grade: "길" },
          }
        : { shop: "dolyeong", category: req.category, flag: { color: "노랑", grade: "길" } };
    case "jokjipge":
      return NATURE_BOARD;
    case "dream":
      return {
        shop: "dream",
        dream: "맑은 냇물에서 커다란 잉어를 두 손으로 잡았어요.",
        symbols: [
          { id: "water_clear", name: "맑은 물" },
          { id: "fish_big", name: "큰 물고기" },
        ],
      };
  }
}

function result(
  req: ReadingRequest,
  createdAt: string,
  id: string = crypto.randomUUID(),
): ReadingResult {
  return {
    id,
    shop: req.shop,
    product: req.product,
    createdAt,
    visual: visualFor(req),
    output: OUT[req.product],
    reused: false,
    disclaimer: DISCLAIMER,
    todayCallsLeft: 30,
    followups: [],
    followupsLeft: 3,
  };
}

function seed(): ReadingResult[] {
  const reqs: ReadingRequest[] = [
    { shop: "tarot", product: "tarot_three", category: "연애", requestId: "" },
    { shop: "dream", product: "dream", checkId: "c", requestId: "" },
    { shop: "saju", product: "saju_full", requestId: "" },
    { shop: "dolyeong", product: "obanggi", category: "재물", requestId: "" },
    { shop: "tarot", product: "tarot_one", category: "오늘", requestId: "" },
  ];
  const out: ReadingResult[] = [];
  for (let i = 0; i < 46; i++) {
    const req = reqs[i % reqs.length] as ReadingRequest;
    const t = Date.now() - (i * 19 + 2) * 3600_000;
    out.push(result(req, new Date(t).toISOString(), `mock-${i}`));
  }
  return out;
}

function load(): Db {
  if (params.get("mock") === "fresh") return { profile: null, readings: seed(), calls: 30 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    // 기기 저장소를 못 쓰면 새로 시작
  }
  return { profile: SAMPLE_PROFILE, readings: seed(), calls: 27 };
}
const db = load();
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // 무시
  }
};

function needProfile() {
  if (!db.profile) throw fail("PROFILE_REQUIRED", "먼저 프로필을 만들어 주세요", 403);
  return db.profile;
}

const NO_PAIR = () => {
  throw fail("NOT_FOUND", "[mock] 같이 보기는 실제 서버(wrangler dev)에서만 돼요", 404);
};

export const mockApi: Api = {
  createInvite: async () => NO_PAIR(),
  invite: async () => NO_PAIR(),
  joinInvite: async () => NO_PAIR(),
  // 당산나무 (F18): 실제 서버에서만
  wishes: async () => {
    throw fail("NOT_FOUND", "[mock] 당산나무는 실제 서버(wrangler dev)에서만 돼요", 404);
  },
  wish: async () => {
    throw fail("NOT_FOUND", "[mock] 당산나무는 실제 서버(wrangler dev)에서만 돼요", 404);
  },
  wishStone: async () => {
    throw fail("NOT_FOUND", "[mock] 당산나무는 실제 서버(wrangler dev)에서만 돼요", 404);
  },
  wishOutcome: async () => {
    throw fail("NOT_FOUND", "[mock] 당산나무는 실제 서버(wrangler dev)에서만 돼요", 404);
  },
  pairReading: async () => NO_PAIR(),
  pairDream: async () => NO_PAIR(),
  pairResult: async () => NO_PAIR(),
  wsToken: async () => NO_PAIR(),
  async session() {
    await wait(300);
    return { userId: "mock-user", hasProfile: !!db.profile, todayCallsLeft: db.calls };
  },
  async deleteMe() {
    await wait();
    db.profile = null;
    db.readings = [];
    db.calls = 30;
    save();
  },
  async getProfile() {
    await wait(200);
    return needProfile();
  },
  async putProfile(input) {
    await wait(700);
    // 프로필을 고쳐도 꾸미기는 그대로 (F17)
    const style = db.profile?.style ?? null;
    const p = makeProfile(input);
    db.profile = { ...p, style, avatarId: avatarString(p.gender, p.ageBand, style) };
    save();
    return db.profile;
  },
  async putStyle(input) {
    await wait(400);
    const p = needProfile();
    db.profile = {
      ...p,
      style: input.style,
      avatarId: avatarString(p.gender, p.ageBand, input.style),
    };
    save();
    return db.profile;
  },
  async menu(shop: ShopId) {
    await wait(200);
    const today = new Date().toDateString();
    return {
      shop,
      items: SHOP_PRODUCTS[shop].map((product) => ({
        product,
        name: PRODUCT_NAMES[product],
        todayReadingId:
          db.readings.find(
            (r) => r.product === product && new Date(r.createdAt).toDateString() === today,
          )?.id ?? null,
      })),
    };
  },
  async check(req) {
    await wait(600);
    if (req.text.trim().length < 5)
      return {
        ok: false,
        reason: "EMPTY",
        message: "아가, 꿈 얘기를 조금만 더 들려줘 봐.",
        todayCallsLeft: db.calls,
      };
    db.calls = Math.max(0, db.calls - 1);
    return {
      ok: true,
      checkId: crypto.randomUUID(),
      symbols: [
        { id: "water_clear", name: "맑은 물" },
        { id: "fish_big", name: "큰 물고기" },
      ],
      todayCallsLeft: db.calls,
    };
  },
  async read(req) {
    needProfile();
    await wait(2200);
    if (db.calls <= 0)
      throw fail("DAILY_LIMIT", "오늘은 점을 충분히 봤어요. 내일 다시 와 주세요", 429);
    db.calls -= 1;
    const r = { ...result(req, new Date().toISOString()), todayCallsLeft: db.calls };
    db.readings.unshift(r);
    save();
    return r;
  },
  async list(cursor) {
    needProfile();
    await wait(400);
    const start = cursor ? Number(cursor) : 0;
    const items: ReadingListItem[] = db.readings.slice(start, start + 20).map((r) => ({
      id: r.id,
      shop: r.shop,
      product: r.product,
      createdAt: r.createdAt,
      summary: r.output.summary,
    }));
    const next = start + 20 < db.readings.length ? String(start + 20) : null;
    return { items, nextCursor: next };
  },
  async get(id) {
    await wait(300);
    const r = db.readings.find((x) => x.id === id);
    if (!r) throw fail("NOT_FOUND", "찾을 수 없는 기록이에요", 404);
    return { ...r, reused: true, todayCallsLeft: db.calls };
  },
  async myTypes() {
    needProfile();
    await wait(300);
    return { type: "earth-mind-soft", matches: allTypeMatches("earth-mind-soft") };
  },
  async createTypeCard() {
    await wait(200);
    return { code: "mockcard01", url: `${location.origin}/?t=mockcard01` };
  },
  async typeCard() {
    await wait(300);
    const match = allTypeMatches("earth-mind-soft").find((m) => m.type === "wood-duty-strong");
    return {
      nickname: "새벽바람",
      type: "wood-duty-strong",
      mine: false,
      viewer: db.profile && match ? { type: "earth-mind-soft", match } : null,
    };
  },
  async remove(id) {
    await wait(300);
    db.readings = db.readings.filter((x) => x.id !== id);
    save();
  },
  async followup(_id, req) {
    await wait(900);
    return {
      followup: {
        id: req.requestId,
        question: req.question,
        answer:
          "[mock] 이번 풀이의 흐름으로 보면, 서두르지 않고 한 걸음씩 가면 좋은 때예요. 요즘 혼자 고민을 오래 붙잡고 있지 않았나요?",
        createdAt: new Date().toISOString(),
      },
      followupsLeft: 2,
      todayCallsLeft: db.calls,
    };
  },
  async daily(): Promise<DailyResponse> {
    const p = needProfile();
    await wait(1100);
    if (params.get("mockerr") === "llm")
      throw fail(
        "LLM_UNAVAILABLE",
        "오늘은 별자리가 구름에 가려 사주가 잘 읽히지 않는구려. 잠시 뒤에 다시 오시오.",
        503,
      );
    const k = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    return {
      date: k,
      iljin: "병오",
      dayMaster: p.dayMaster.stem,
      score: 82,
      scoreLabel: "좋음",
      luckyNumbers: [3, 8],
      result: OUT.daily,
      disclaimer: DISCLAIMER,
    };
  },
};

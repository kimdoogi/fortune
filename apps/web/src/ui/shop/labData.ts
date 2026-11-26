/**
 * ui-lab 전용 가짜 데이터 (개발용, 배포 빌드에 들어가지 않음). 실제 길이에 가까운 한국어 예시.
 */
import { bestAndWorst } from "@fortune/fortune-engine/src/types60";
import {
  DISCLAIMER,
  type InterpretOutput,
  type ProductId,
  type ProfileView,
  type ReadingVisual,
} from "@fortune/shared-types";

export const LAB_PROFILE: ProfileView = {
  nickname: "하늘",
  calendar: "solar",
  birthDate: "1996-03-12",
  isLeapMonth: false,
  birthTime: { kind: "clock", hour: 14, minute: 30 },
  gender: "female",
  ageBand: "20대",
  avatarId: "female:20대",
  style: null,
  dayMaster: { stem: "갑", element: "목", yinYang: "양" },
  zodiac: "쥐",
  flags: { ambiguousTime: false, solarTermDay: false },
};

/** 족집게집 나는 어떤 사람 예시 (F19). lab·mock이 같이 쓴다. 실제 문장은 배포 서버에서 본다 */
export const NATURE_SAMPLE: InterpretOutput = {
  greeting: "어서 오게. 자네 얼굴부터 돋보기로 보세.",
  summary: "겉은 태평, 속은 다 재고 있는 사람",
  sections: {
    surface:
      "처음 보는 자리에선 자네가 제일 느긋해 보이네. 웃으며 고개만 끄덕이니 다들 순한 사람인 줄 알지. 실은 그 자리에서 누가 무슨 말을 했는지 다 기억하고 있구먼. 첫인상 덕을 보지만 속을 안 보여 줘서 친해지는 데 오래 걸리네.",
    inner:
      "혼자 있을 땐 오늘 한 말을 몇 번이고 되감아 보는 사람이네. 괜히 그 말을 했나 싶어 잠을 설친 날이 꽤 되지? 생각이 깊은 건 자네 힘이지만, 지나간 장면에 붙잡혀 다음 할 일을 미루게 되네. 자기 전에 오늘 잘한 일 하나만 적어 두게.",
    people:
      "모임에선 먼저 나서지 않아도 결국 자네가 일정을 짜고 있구먼. 챙겨 주는 맛에 사는 사람이라 고맙다는 말 한마디에 다 풀리지. 대신 그 말이 없으면 속으로 장부를 적어 두네. 서운한 건 그날 가볍게 말하게.",
    atWork:
      "일을 맡으면 끝을 봐야 잠이 오는 사람이네. 남이 대충 한 걸 보면 몰래 다시 손보고 있지? 꼼꼼함은 믿음을 사지만 혼자 다 떠안다 마감 전날 지쳐 버리네. 이번 주엔 한 가지를 남에게 통째로 맡겨 보게.",
    inLove:
      "좋아하는 사람 앞에선 말보다 행동이 먼저 나가는 사람이네. 상대가 지나가듯 한 말을 기억해 뒀다가 챙겨 주지. 그런데 정작 내 마음은 말을 안 해서 상대가 헷갈려하네. 고마운 건 그 자리에서 말로 하게.",
    match:
      "자네와 잘 맞는 건 씩씩한 호랑이 같은 사람이네. 말수는 적어도 맡은 일은 끝까지 지는 사람 곁에서 자네가 마음을 놓지. 반대로 깔끔한 다람쥐처럼 생각이 많은 사람과는 서로 눈치만 보다 하루가 가네. 그런 사람과는 할 말을 먼저 짧게 꺼내 주게.",
    stress:
      "화가 나면 말이 줄고 얼굴이 굳는 사람이네. 겉으론 괜찮다 하면서 집에 가는 길에 혼자 다 쏟아 내지. 참는 힘은 크지만 쌓이면 엉뚱한 데서 터지네. 답답한 날엔 땀 날 만큼 걷고 오게.",
  },
  advice: "잘 맞는 사람 곁에선 자네 장점이 두 배로 빛나네.",
};

export const NATURE_BOARD: ReadingVisual = {
  shop: "jokjipge",
  nature: {
    dayMaster: { stem: "기", element: "토", yinYang: "음" },
    elements: { 목: 1, 화: 2, 토: 3, 금: 1, 수: 0 },
    strong: "인성",
    absent: ["재성"],
    hourUnknown: false,
    // 60유형 (D-101)
    type: "earth-mind-soft",
    best: bestAndWorst("earth-mind-soft").best.map(({ type, score, label }) => ({
      type,
      score,
      label,
    })),
    worst: bestAndWorst("earth-mind-soft").worst.map(({ type, score, label }) => ({
      type,
      score,
      label,
    })),
  },
};

export const LAB_OUTPUT: Record<ProductId, InterpretOutput> = {
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
    greeting: "그대, 오늘 하루도 잘 왔구려.",
    summary: "작은 정리가 큰 여유를 부르는 날이오",
    sections: {
      overall:
        "오늘은 불의 기운이 조용히 피어오르는 병오일이오. 곧게 뻗는 나무인 그대에게는 재주를 밖으로 보여 주기 좋은 흐름이구려. 다만 마음이 앞서 일을 한꺼번에 벌이면 금세 지칠 수 있으니, 아침에 할 일 세 가지만 골라 두시오. 오후에는 뜻밖의 연락이 반가운 소식을 들고 올 수 있소.",
      tip: "책상 위 물건 하나를 제자리에 두시오. 마음도 함께 가지런해질 것이오.",
    },
    advice: "서두르지 않아도 때는 오는 법이오.",
    luckyColor: "청록",
  },
  saju_full: {
    greeting: "어서 오시오. 그대의 사주를 펼쳐 보았구려.",
    summary: "곧게 자라는 큰 나무, 올해는 꽃을 피울 때요",
    sections: {
      overall:
        "그대는 갑목, 하늘을 향해 곧게 뻗는 큰 나무의 기운을 타고났소. 뜻이 분명하고 한번 마음먹은 일은 끝까지 해내는 힘이 있구려. 사주에 불의 기운이 넉넉해 재주가 밖으로 잘 드러나지만, 물이 조금 모자라 쉬어 가는 여유를 챙겨야 하오. 올해는 그동안 쌓아 둔 재주를 사람들 앞에 보여 주기 좋은 해이니, 망설이던 일을 한 걸음 내디뎌 보시구려.",
      personality:
        "곧은 나무처럼 바르고 정직한 성품이오. 남의 부탁을 쉽게 거절하지 못해 혼자 짐을 지는 때가 많았을 것이오. 그대의 다정함은 큰 장점이니, 가끔은 '오늘은 어렵소'라고 말하는 것도 스스로를 지키는 지혜라오.",
      elements:
        "나무 둘, 불 셋, 흙 둘, 쇠 하나, 물은 없소. 불이 많아 열정과 표현력이 좋고, 물이 없으니 생각을 식히고 고르는 시간이 부족하기 쉽구려. 물가를 걷거나 차를 천천히 마시는 습관이 기운을 고르게 해 줄 것이오.",
      yongsin:
        "그대에게 도움이 되는 기운, 곧 용신은 물(수)이오. 물은 나무를 기르고 지나친 불을 식혀 주니, 차분히 배우고 쉬는 시간이 그대를 더 크게 키워 줄 것이오.",
      daewoon:
        "지금 지나는 대운은 흙의 기운이 강한 시기라, 터를 다지고 살림을 꾸리는 데 힘이 실리오. 크게 벌이기보다 하나씩 쌓아 올리면 몇 해 뒤 든든한 열매가 되어 돌아올 것이오.",
      thisYear:
        "올해는 불의 기운이 들어오니 그대의 재주가 빛을 보기 좋은 해이오. 새로운 사람을 만나고 이름을 알릴 기회가 생기는구려. 다만 여름에는 기운이 지나치게 달아오를 수 있으니 잠을 넉넉히 자 두시오.",
      months:
        "◎ 12월 — 윗사람이 그대를 눈여겨보니, 연말 모임에서 하고 싶은 일을 한마디 꺼내 두시오.\n△ 2027년 2월 — 계약서·서류 문구를 대충 넘기면 손해가 나오. 서명 전에 하루만 묵혀 두시구려.\n◎ 2027년 5월 — 자격증 공부가 결실을 보는 달이오. 4월 안에 시험 접수를 마쳐 두시오.\n△ 2027년 6월 — 가까운 사람과 말 한마디로 서운함이 생기기 쉽소. 저녁 늦게 하는 중요한 얘기는 다음 날로 미루시오.\n◎ 2027년 9월 — 돈이 들어오는 길이 넓어지오. 미뤄 둔 부업이나 가격 협상을 이때 꺼내시구려.",
      love: "마음을 솔직히 표현하면 좋은 반응이 돌아오는 해이오. 이미 곁에 있는 이에게는 작은 고마움을 자주 전하시구려.",
      money:
        "들어오는 길은 넓어지나 나가는 길도 함께 넓어지오. 한 달에 한 번 씀씀이를 돌아보면 살림이 한결 넉넉해질 것이오.",
      work: "맡은 일에서 재주를 드러낼 기회가 오니, 의견을 내는 데 주저하지 마시오. 윗사람의 도움이 따르는 해이오.",
    },
    advice: "오늘 할 수 있는 작은 일부터 해 보시구려. 때는 반드시 오는 법이오.",
    luckyColor: "남색",
  },
  tarot_one: {
    greeting: "하늘 님, 카드가 마음을 열어 줬어요.",
    summary: "지친 마음에 별빛 같은 회복이 찾아와요",
    sections: {
      card: "오늘 당신에게 온 카드는 '별'이에요. 맑은 밤하늘 아래, 별 하나가 유난히 반짝이고 그 빛이 잔잔한 물 위로 내려앉는 그림이에요. 이 카드는 오래 애쓴 마음이 조금씩 회복되고, 다시 희망을 품어도 괜찮다는 뜻을 담고 있어요.",
      message:
        "오늘은 스스로에게 칭찬 한마디를 건네 봐요. 작은 기대를 품는 것만으로도 하루가 한결 가벼워질 거예요.",
    },
    advice: "오늘 밤엔 하늘을 한 번 올려다봐요.",
  },
  tarot_three: {
    greeting: "하늘 님, 세 장의 카드가 이야기를 들려줄 거예요.",
    summary: "망설임을 지나 환한 햇살로 이어지는 흐름",
    sections: {
      past: "과거 자리에는 '바보' 카드가 나왔어요. 작은 봇짐을 멘 여행자가 가볍게 첫발을 내딛는 그림이에요. 지난날의 당신은 계산보다 설렘을 따라 새로운 일을 시작했던 것 같아요. 그 용기가 지금의 당신을 여기까지 데려왔어요.",
      present:
        "현재 자리의 '달'은 역방향이에요. 안개 낀 길 위로 달빛이 흐릿하게 비치는 그림인데, 역방향이라 막연하던 불안이 조금씩 걷히는 중이라는 뜻에 가까워요. 아직 모든 게 또렷하진 않지만, 마음속 걱정을 하나씩 말로 꺼내 보면 생각보다 작다는 걸 알게 될 거예요.",
      future:
        "미래에는 '태양'이 떠올랐어요. 해바라기 너머로 환한 해가 비추는 그림이에요. 지금의 고민이 지나가면 마음이 활짝 펴지고, 주변 사람들과 기쁨을 나눌 일이 생길 수 있어요. 그 빛을 혼자 간직하지 말고 함께 나눠 봐요.",
      advice:
        "세 장을 이어 보면, 용기 있게 시작한 일이 잠시 안개를 지나 밝은 곳으로 향하고 있어요. 지금은 서두르기보다 하루에 하나씩 확인하며 걸어가면 좋아요.",
    },
    advice: "걱정을 한 줄로 적어 보고, 그 옆에 할 수 있는 일 하나를 적어 봐요.",
  },
  sinjeom: {
    greeting: "딸랑딸랑!",
    summary: "요즘 친구 사이 고민",
    sections: {
      gongsu:
        "일곱 알이다! 할아버지가 제일 좋은 수래!\n너 요즘 친구한테 서운한 거 꾹 참았지?!\n다음 주에 먼저 연락 와. 금방 풀린대!\n오늘 먼저 웃으면서 인사해. 말은 짧게!",
    },
    advice: "오늘 먼저 웃으면서 인사해 봐!",
  },
  obanggi: {
    greeting: "딸랑딸랑! 하늘아, 깃발 뽑았어!",
    summary: "노란 깃발! 도와주는 사람이 곁에 있대",
    sections: {
      flag: "우와, 노란 깃발이다! 노란색은 따뜻한 해님 색이야. 이 깃발은 주변에 하늘이를 도와주는 사람이 있다는 뜻이래. 혼자 끙끙 앓지 말고 손을 내밀면 일이 훨씬 쉬워진대.",
      message:
        "요즘 일이 좀 많았지? 흠흠, 다 혼자 하려고 해서 그래. 노란 깃발은 선배나 동료한테 물어보면 실마리가 풀린다고 했어. 물어보는 건 부끄러운 게 아니야. 오히려 같이 하면 더 재밌어! 그리고 고마운 사람한테 고맙다고 말하면 좋은 일이 또 생긴대. 딸랑!",
      advice:
        "오늘은 고마운 사람한테 안부 한마디 보내 봐. 맛있는 간식도 같이 나눠 먹으면 더 좋아! 그럼 기운이 쑥쑥 날 거야.",
    },
    advice: "오늘은 맛있는 거 먹어. 그럼 기운 난다!",
  },
  dream: {
    greeting: "아이고, 우리 아가 꿈 얘기 잘 들었구먼.",
    summary: "맑은 물과 큰 물고기, 복이 들어오는 꿈이여",
    sections: {
      symbols:
        "맑은 냇가에서 커다란 물고기를 두 손으로 잡았다고? 아이고, 그거 참 좋은 꿈이여. 맑은 물은 마음이 깨끗해지고 일이 술술 풀리는 때라는 뜻이구먼. 물고기는 재물과 좋은 기회를 뜻하는데, 그걸 두 손으로 꼭 잡았으니 들어온 복을 놓치지 않는다는 거여.",
      meaning:
        "요즘 아가가 애쓴 일이 있다면 그게 조금씩 결실을 맺을 때가 됐다는 신호여. 꿈속에서 물이 맑았다니 마음도 한결 가벼워질 거구먼. 다만 복은 혼자 꽁꽁 쥐고 있으면 답답해지니, 고마운 사람들과 나누면 더 커지는 법이여.",
      advice: "오늘은 따뜻한 밥 한 끼 든든히 먹고, 하고 싶었던 일 하나만 해 봐. 할매가 응원할게.",
    },
    advice: "꿈은 꿈이고, 오늘은 아가가 하고 싶은 일 하나만 해 봐.",
  },
  nature: NATURE_SAMPLE,
};

export function labVisual(
  product: ProductId,
  opts: { hourUnknown?: boolean; category?: string },
): ReadingVisual {
  switch (product) {
    case "saju_full":
    case "daily":
      return {
        shop: "saju",
        board: {
          pillars: {
            year: "병자",
            month: "신묘",
            day: "갑오",
            hour: opts.hourUnknown ? null : "신미",
          },
          hourUnknown: Boolean(opts.hourUnknown),
          dayMaster: { stem: "갑", element: "목", yinYang: "양" },
          elements: opts.hourUnknown
            ? { 목: 2, 화: 2, 토: 0, 금: 1, 수: 1 }
            : { 목: 2, 화: 3, 토: 2, 금: 1, 수: 0 },
          strength: "신약",
          yongsin: "수",
          months: [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((month, i) => ({
            year: month >= 11 ? 2026 : 2027,
            month,
            grade:
              i === 1 || i === 6 || i === 10 ? "good" : i === 3 || i === 7 ? "caution" : "normal",
          })),
        },
      };
    case "tarot_one":
      return {
        shop: "tarot",
        spread: "one",
        category: (opts.category as "오늘") ?? "오늘",
        cards: [{ position: "오늘", id: 17, name: "별", reversed: false }],
      };
    case "tarot_three":
      return {
        shop: "tarot",
        spread: "three",
        category: (opts.category as "연애") ?? "연애",
        cards: [
          { position: "과거", id: 0, name: "바보", reversed: false },
          { position: "현재", id: 18, name: "달", reversed: true },
          { position: "미래", id: 19, name: "태양", reversed: false },
        ],
      };
    case "sinjeom":
      return {
        shop: "dolyeong",
        category: null,
        flag: { color: "노랑", grade: "길" },
        mode: "sinjeom",
        rice: { count: 7, grade: "대길" },
      };
    case "gunghap":
      return {
        shop: "saju",
        gunghap: {
          score: 78,
          label: "잘 맞는 사이",
          relation: "연인",
          a: { nickname: "하나", zodiac: "쥐", dayStem: "임", element: "수" },
          b: { nickname: "준호", zodiac: "소", dayStem: "갑", element: "목" },
          factors: [
            { name: "물·나무 서로 살림", good: true },
            { name: "쥐띠·소띠 잘 맞음", good: true },
            { name: "가까울수록 다툼", good: false },
          ],
        },
      };
    case "tarot_pair":
      return {
        shop: "tarot",
        spread: "three",
        category: "연애",
        cards: [
          { position: "하나 님의 마음", id: 17, name: "별", reversed: false },
          { position: "준호 님의 마음", id: 18, name: "달", reversed: true },
          { position: "두 사람의 앞날", id: 19, name: "태양", reversed: false },
        ],
      };
    case "sinjeom_pair":
      return {
        shop: "dolyeong",
        category: null,
        flag: { color: "노랑", grade: "대길" },
        mode: "sinjeom",
        rice: { count: 7, grade: "대길" },
      };
    case "dream_pair":
      return {
        shop: "dream",
        pair: [
          {
            nickname: "하나",
            dream: "맑은 냇가에서 커다란 물고기를 두 손으로 잡았어요.",
            symbols: [
              { id: "water", name: "물" },
              { id: "fish", name: "물고기" },
            ],
          },
          {
            nickname: "준호",
            dream: "하늘을 훨훨 날다가 높은 산 위에 내려앉았어요.",
            symbols: [
              { id: "flying", name: "날기" },
              { id: "mountain", name: "산" },
            ],
          },
        ],
      };
    case "obanggi":
      return {
        shop: "dolyeong",
        category: (opts.category as "직장") ?? "직장",
        flag: { color: "노랑", grade: "길" },
      };
    case "nature":
      return NATURE_BOARD;
    case "dream":
      return {
        shop: "dream",
        dream: "맑은 냇가에서 커다란 물고기를 두 손으로 잡았어요. 물이 유리처럼 투명했어요.",
        symbols: [
          { id: "water", name: "물" },
          { id: "river", name: "강" },
          { id: "fish", name: "물고기" },
        ],
      };
  }
}

export const LAB_DISCLAIMER = DISCLAIMER;

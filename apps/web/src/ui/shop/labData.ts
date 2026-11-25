/**
 * ui-lab 전용 가짜 데이터 (개발용, 배포 빌드에 들어가지 않음). 실제 길이에 가까운 한국어 예시.
 */
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
  dayMaster: { stem: "갑", element: "목", yinYang: "양" },
  zodiac: "쥐",
  flags: { ambiguousTime: false, solarTermDay: false },
};

export const LAB_OUTPUT: Record<ProductId, InterpretOutput> = {
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
        "딸랑딸랑! 잠깐… 보인다 보여!\n너 요즘 친구한테 서운한 거 꾹 참고 있지?!\n근데 오늘 노란 기운이 보여. 곧 풀린대!\n맞지? 맞지?",
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
      };
    case "obanggi":
      return {
        shop: "dolyeong",
        category: (opts.category as "직장") ?? "직장",
        flag: { color: "노랑", grade: "길" },
      };
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

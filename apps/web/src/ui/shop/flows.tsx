/**
 * 점집별 점 보는 흐름 (F05~F08) + 사주집 안 오늘의 운세 (F13).
 * - 카드·깃발을 고르는 탭은 연출일 뿐이다. 요청은 카테고리를 고르자마자 보내고, 결과는 서버가 정한다 (03)
 * - 기다리는 2~5초는 점 보는 연출로 채운다 (06, D-044)
 */
import type {
  CheckResponse,
  DailyResponse,
  DolyeongCategory,
  ProfileView,
  ReadingResult,
  ShopId,
  TarotCategory,
} from "@fortune/shared-types";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { api, newRequestId } from "../../api/client";
import { sfx } from "../../audio/sound";
import { DailyScore } from "../reading/DailyScore";
import { OutputView, ResultSheet } from "../reading/ResultView";
import { TarotBack, TarotFace } from "../reading/tarotArt";
import {
  CategoryIcon,
  DreamSymbols,
  FLAG_ADJ,
  FlagArt,
  GradeSeal,
  RolledFlag,
} from "../reading/visuals";
import type { NpcAction } from "./ShopScreen";
import { CHARACTERS } from "./characters";
import { atLeast, birthLine, dailyDateLabel, fanAngles, josaA } from "./helpers";

/** 다시 해 보기 때 이어서 시작할 자리 */
export interface Resume {
  category?: string;
  text?: string;
  checkId?: string;
  symbols?: { id: string; name: string }[];
}

export interface FlowProps {
  shop: ShopId;
  profile: ProfileView;
  resume?: Resume;
  say: (line: string, busy?: boolean) => void;
  npc: (a: NpcAction) => void;
  onResult: (r: ReadingResult) => void;
  onFail: (err: unknown, resume: Resume) => void;
  onCrisis: () => void;
  onCallsLeft?: (n: number) => void;
}

const Spark = () => (
  <span class="sh-sparks" aria-hidden="true">
    {Array.from({ length: 12 }, (_, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 장식 목록
      <i key={i} style={{ "--k": i }} />
    ))}
  </span>
);

function Primary(props: { onClick: () => void; children: string; disabled?: boolean }) {
  return (
    <button type="button" class="sh-primary" onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  );
}

function CategoryPicker<T extends string>(props: { options: T[]; onPick: (c: T) => void }) {
  return (
    <div class={props.options.length > 4 ? "sh-cats sh-cats-5" : "sh-cats"}>
      {props.options.map((c, i) => (
        <button
          type="button"
          key={c}
          class="sh-cat"
          style={{ "--i": i }}
          onClick={() => props.onPick(c)}
        >
          <CategoryIcon category={c} />
          {c}
        </button>
      ))}
    </div>
  );
}

/** 요청 하나를 들고 있다가 실패하면 바로 알린다 (연출 도중이라도) */
function useJob<T>(onFail: (err: unknown) => void) {
  const [value, setValue] = useState<T | null>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const start = (p: Promise<T>) => {
    setValue(null);
    p.then(
      (v) => alive.current && setValue(v),
      (e) => alive.current && onFail(e),
    );
  };
  return { value, start };
}

// ── 사주 정밀 (F05) ──────────────────────────────────────

/** 화면 말은 쉽게 (D-083) */
const EL_WORD: Record<string, string> = { 목: "나무", 화: "불", 토: "흙", 금: "쇠", 수: "물" };

export function SajuFlow(props: FlowProps): JSX.Element {
  const c = CHARACTERS.saju;
  const [step, setStep] = useState<"confirm" | "loading">(props.resume ? "loading" : "confirm");

  // biome-ignore lint/correctness/useExhaustiveDependencies: 단계가 바뀔 때만 실행한다 (콜백은 렌더마다 새로 만들어짐)
  useEffect(() => {
    if (step === "confirm") {
      props.say("그대가 태어난 날의 여덟 글자를 펼쳐 보겠소. 마음의 준비가 되었소?");
      return;
    }
    props.npc("talk");
    props.say(c.loading, true);
    let alive = true;
    atLeast(api.read({ shop: "saju", product: "saju_full", requestId: newRequestId() }), 2600).then(
      (r) => alive && props.onResult(r),
      (e) => alive && props.onFail(e, {}),
    );
    return () => {
      alive = false;
    };
  }, [step]);

  if (step === "confirm") {
    const p = props.profile;
    return (
      <div class="sh-block">
        <div class="sh-profile">
          <span class="sh-profile-name">{p.nickname}</span>
          <span>{birthLine(p)}</span>
          <span class="sh-profile-sub">
            {EL_WORD[p.dayMaster.element] ?? p.dayMaster.element} 기운 · {p.zodiac}띠
          </span>
        </div>
        <Primary onClick={() => setStep("loading")}>사주판 펼치기</Primary>
      </div>
    );
  }
  return (
    <div class="sh-block">
      <div class="sh-unroll" aria-hidden="true">
        <span class="sh-rod sh-rod-l" />
        <div class="sh-unroll-paper">
          {["시", "일", "월", "년"].map((l, i) => (
            <div class="sh-unroll-col" key={l} style={{ "--i": i }}>
              <span>{l}</span>
              <i />
              <i />
            </div>
          ))}
        </div>
        <span class="sh-rod sh-rod-r" />
      </div>
    </div>
  );
}

// ── 타로 (F06) ───────────────────────────────────────────

const TAROT_CATS: TarotCategory[] = ["연애", "재물", "직장", "오늘"];

/** 세 장은 고른 순서대로 과거·현재·미래 자리에 놓인다 */
const TAROT_POS = ["과거", "현재", "미래"] as const;

export function TarotFlow(
  props: FlowProps & { product: "tarot_one" | "tarot_three" },
): JSX.Element {
  const c = CHARACTERS.tarot;
  const need = props.product === "tarot_three" ? 3 : 1;
  const initial = TAROT_CATS.find((x) => x === props.resume?.category);
  const [category, setCategory] = useState<TarotCategory | null>(initial ?? null);
  const [picked, setPicked] = useState<number[]>([]);
  const [stage, setStage] = useState<"choose" | "fan" | "reveal">(initial ? "fan" : "choose");
  const [flipped, setFlipped] = useState(0);
  const job = useJob<ReadingResult>((e) => props.onFail(e, { category: category ?? undefined }));
  const nick = props.profile.nickname;

  const begin = (cat: TarotCategory) => {
    setCategory(cat);
    setStage("fan");
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: 단계가 바뀔 때만 실행한다 (콜백은 렌더마다 새로 만들어짐)
  useEffect(() => {
    if (stage === "choose") {
      props.say(`${nick} 님, 어떤 이야기가 궁금해요?`);
    } else if (stage === "fan" && category) {
      // 카테고리를 고르자마자 요청한다. 카드를 고르는 동안 서버가 준비한다
      job.start(
        api.read({ shop: "tarot", product: props.product, category, requestId: newRequestId() }),
      );
      props.npc("present");
      sfx("shuffle");
      props.say(
        need === 3
          ? "마음속으로 질문을 떠올리고 과거, 현재, 미래 순서로 한 장씩 골라 봐요. 고른 카드를 다시 누르면 내려놓을 수 있어요."
          : "숨을 한 번 고르고, 끌리는 카드 한 장을 골라 봐요. 다시 누르면 내려놓을 수 있어요.",
      );
    }
  }, [stage]);

  /** 고른 카드를 다시 누르면 내려놓는다. 뒤에 고른 카드는 한 자리씩 앞당겨진다 */
  const toggle = (i: number) => {
    if (stage !== "fan") return;
    sfx("flip");
    if (picked.includes(i)) setPicked(picked.filter((x) => x !== i));
    else if (picked.length < need) setPicked([...picked, i]);
  };
  const full = picked.length >= need;

  const result = job.value;
  const cards = result?.visual.shop === "tarot" ? result.visual.cards : [];

  // 결과가 오면 한 장씩 뒤집는다
  // biome-ignore lint/correctness/useExhaustiveDependencies: 단계가 바뀔 때만 실행한다 (콜백은 렌더마다 새로 만들어짐)
  useEffect(() => {
    if (stage !== "reveal") return;
    if (!result) {
      props.say(c.loading, true);
      return;
    }
    props.npc("talk");
    props.say(
      need === 3
        ? `${nick} 님, 카드가 마음을 열어 줬어요. 함께 볼까요?`
        : `${nick} 님, 이 카드가 오늘 찾아왔어요.`,
    );
    let k = 0;
    const id = setInterval(() => {
      k += 1;
      setFlipped(k);
      sfx("flip");
      if (k >= cards.length) clearInterval(id);
    }, 650);
    return () => clearInterval(id);
  }, [stage, result]);

  if (stage === "choose") {
    return (
      <div class="sh-block">
        <CategoryPicker options={TAROT_CATS} onPick={begin} />
      </div>
    );
  }

  const angles = fanAngles(22, 76);
  return (
    <>
      <div class="sh-block">
        <div class={stage === "reveal" ? "sh-fan sh-fan-out" : "sh-fan"}>
          {angles.map((a, i) => {
            const order = picked.indexOf(i);
            const on = order >= 0;
            const pos = need === 3 ? TAROT_POS[order] : "오늘";
            return (
              <button
                type="button"
                key={a}
                class={on ? "sh-fcard sh-fcard-on" : "sh-fcard"}
                style={{ "--a": `${a}deg`, "--i": i }}
                aria-label={on ? `${pos} 카드 (다시 누르면 내려놓아요)` : `${i + 1}번째 카드`}
                aria-pressed={on}
                disabled={stage !== "fan" || (!on && full)}
                onClick={() => toggle(i)}
              >
                <TarotBack />
                {on && <span class="sh-fcard-tag">{pos}</span>}
              </button>
            );
          })}
        </div>
        {stage === "fan" && full ? (
          <div class="sh-fan-go">
            <Primary onClick={() => setStage("reveal")}>
              {need === 3 ? "이 세 장으로 펼치기" : "이 카드로 볼게요"}
            </Primary>
            <p class="sh-count">바꾸고 싶으면 고른 카드를 다시 눌러요</p>
          </div>
        ) : (
          <p class="sh-count">
            {need === 3
              ? `${TAROT_POS[picked.length] ?? "미래"} 카드를 골라 주세요 · ${picked.length} / 3장`
              : "끌리는 카드를 한 장 골라 주세요"}
          </p>
        )}
      </div>

      {stage === "reveal" && (
        <div class="sh-stage">
          <div class={need === 3 ? "sh-reveal sh-reveal-3" : "sh-reveal"}>
            {(cards.length ? cards : Array.from({ length: need }, () => null)).map((card, i) => (
              <div
                class="sh-rcard"
                key={card ? `${card.position}${card.id}` : i}
                style={{ "--i": i }}
              >
                <span class="sh-rcard-pos">
                  {card?.position ?? (need === 3 ? ["과거", "현재", "미래"][i] : "오늘")}
                </span>
                <div
                  class={
                    card && flipped > i
                      ? "sh-flip sh-flip-on"
                      : result
                        ? "sh-flip"
                        : "sh-flip sh-flip-wait"
                  }
                >
                  <div class="sh-flip-inner">
                    <div class="sh-flip-back">
                      <TarotBack />
                    </div>
                    <div class="sh-flip-front">
                      {card && (
                        <div class={card.reversed ? "rd-rev" : ""}>
                          <TarotFace id={card.id} name={card.name} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <span class={card && flipped > i ? "sh-rcard-name sh-in" : "sh-rcard-name"}>
                  {card?.name ?? " "}
                  {card?.reversed && <em>역방향</em>}
                </span>
              </div>
            ))}
          </div>
          {result && flipped >= cards.length ? (
            <div class="sh-stage-foot sh-in">
              <Primary onClick={() => props.onResult(result)}>풀이 듣기</Primary>
            </div>
          ) : (
            <p class="sh-stage-hint">
              {result ? "카드를 뒤집는 중…" : "카드가 이야기를 고르고 있어요…"}
            </p>
          )}
        </div>
      )}
    </>
  );
}

// ── 아기도령 오방기 (F07) ────────────────────────────────

const DOL_CATS: DolyeongCategory[] = ["연애", "재물", "직장", "건강", "기타"];

export function DolyeongFlow(props: FlowProps): JSX.Element {
  const c = CHARACTERS.dolyeong;
  const initial = DOL_CATS.find((x) => x === props.resume?.category);
  const [category, setCategory] = useState<DolyeongCategory | null>(initial ?? null);
  const [stage, setStage] = useState<"choose" | "flags" | "unfurl">(initial ? "flags" : "choose");
  const [picked, setPicked] = useState<number | null>(null);
  const job = useJob<ReadingResult>((e) => props.onFail(e, { category: category ?? undefined }));
  const nick = props.profile.nickname;
  const result = job.value;
  const flag = result?.visual.shop === "dolyeong" ? result.visual.flag : null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 단계가 바뀔 때만 실행한다 (콜백은 렌더마다 새로 만들어짐)
  useEffect(() => {
    if (stage === "choose") props.say("뭐가 궁금해? 하나 골라 봐!");
    else if (stage === "flags" && category) {
      job.start(
        api.read({ shop: "dolyeong", product: "obanggi", category, requestId: newRequestId() }),
      );
      props.npc("present");
      sfx("bell");
      props.say("딸랑딸랑! 깃발 다섯 개 말아 왔어. 마음에 드는 거 하나 뽑아!");
    }
  }, [stage]);

  useEffect(() => {
    if (picked === null) return;
    const t = setTimeout(() => setStage("unfurl"), 650);
    return () => clearTimeout(t);
  }, [picked]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 단계가 바뀔 때만 실행한다 (콜백은 렌더마다 새로 만들어짐)
  useEffect(() => {
    if (stage !== "unfurl") return;
    if (!flag) {
      props.say(c.loading, true);
      return;
    }
    const good = flag.grade === "대길" || flag.grade === "길";
    props.npc(good ? "celebrate" : "talk");
    props.say(
      good
        ? `우와! ${nick}${josaA(nick)}, ${FLAG_ADJ[flag.color]} 깃발이다! 이거 좋은 거야!`
        : `흠흠, ${FLAG_ADJ[flag.color]} 깃발이 나왔어. 무슨 뜻인지 들어 봐.`,
    );
  }, [stage, flag]);

  if (stage === "choose") {
    return (
      <div class="sh-block">
        <CategoryPicker
          options={DOL_CATS}
          onPick={(cat) => {
            setCategory(cat);
            setStage("flags");
          }}
        />
      </div>
    );
  }

  return (
    <>
      <div class="sh-block">
        <div class="sh-flags">
          {[0, 1, 2, 3, 4].map((i) => (
            <button
              type="button"
              key={i}
              class={
                picked === i
                  ? "sh-rflag sh-rflag-on"
                  : picked !== null
                    ? "sh-rflag sh-rflag-off"
                    : "sh-rflag"
              }
              style={{ "--i": i }}
              aria-label={`${i + 1}번째 깃발`}
              disabled={picked !== null}
              onClick={() => setPicked(i)}
            >
              <RolledFlag />
            </button>
          ))}
        </div>
      </div>

      {stage === "unfurl" && (
        <div class="sh-stage">
          {flag ? (
            <div class="sh-unfurl">
              {(flag.grade === "대길" || flag.grade === "길") && <Spark />}
              <FlagArt color={flag.color} class="sh-unfurl-art" />
              <div class="sh-unfurl-cap">
                <span>
                  {category} · <b>{FLAG_ADJ[flag.color]} 깃발</b>
                </span>
                <GradeSeal grade={flag.grade} />
              </div>
              <div class="sh-stage-foot sh-in-late">
                <Primary onClick={() => result && props.onResult(result)}>풀이 듣기</Primary>
              </div>
            </div>
          ) : (
            <div class="sh-unfurl">
              <RolledFlag class="sh-shake" />
              <p class="sh-stage-hint">딸랑딸랑… 깃발을 펼치는 중이야</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── 꿈해몽 (F08) ─────────────────────────────────────────

export const DREAM_MAX = 300;

export function DreamFlow(props: FlowProps): JSX.Element {
  const c = CHARACTERS.dream;
  const r = props.resume;
  const [text, setText] = useState(r?.text ?? "");
  const [stage, setStage] = useState<"write" | "checking" | "brewing">(
    r?.checkId ? "brewing" : "write",
  );
  const [symbols, setSymbols] = useState(r?.symbols ?? []);
  const [checkId, setCheckId] = useState(r?.checkId ?? "");
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: 단계가 바뀔 때만 실행한다 (콜백은 렌더마다 새로 만들어짐)
  useEffect(() => {
    if (stage === "write" && !r?.text) props.say("무슨 꿈을 꿨어? 할매한테 천천히 얘기해 봐.");
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 단계가 바뀔 때만 실행한다 (콜백은 렌더마다 새로 만들어짐)
  useEffect(() => {
    if (stage !== "brewing" || !checkId) return;
    sfx("pour");
    props.npc("talk");
    props.say(c.loading, true);
    atLeast(
      api.read({ shop: "dream", product: "dream", checkId, requestId: newRequestId() }),
      2800,
    ).then(
      (res) => alive.current && props.onResult(res),
      (e) => alive.current && props.onFail(e, { text, checkId, symbols }),
    );
  }, [stage, checkId]);

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setStage("checking");
    props.say("어디 보자… 할매가 듣고 있어.", true);
    let res: CheckResponse;
    try {
      res = await api.check({ shop: "dream", text: t });
    } catch (e) {
      if (alive.current) props.onFail(e, { text });
      return;
    }
    if (!alive.current) return;
    props.onCallsLeft?.(res.todayCallsLeft);
    if (!res.ok) {
      if (res.reason === "CRISIS") {
        props.onCrisis();
        return;
      }
      setStage("write");
      props.say(res.message);
      return;
    }
    setSymbols(res.symbols);
    setCheckId(res.checkId);
    setStage("brewing");
  };

  if (stage === "brewing") {
    return (
      <div class="sh-block sh-brew">
        <svg viewBox="0 0 120 90" class="sh-cup" aria-hidden="true">
          <g class="sh-steam" fill="none" stroke="#f6ead2" stroke-width="3" stroke-linecap="round">
            <path d="M44 34c-6-8 6-12 0-22" />
            <path d="M60 32c-6-8 6-12 0-24" />
            <path d="M76 34c-6-8 6-12 0-22" />
          </g>
          <ellipse cx="60" cy="82" rx="38" ry="6" fill="#2a1a10" opacity="0.35" />
          <path d="M26 44h68c0 22-14 36-34 36S26 66 26 44z" fill="#7fb3a2" />
          <path d="M26 44h68c0 4-1 8-2.5 11H28.5C27 52 26 48 26 44z" fill="#9cc9b8" />
          <ellipse cx="60" cy="44" rx="34" ry="6" fill="#5a3a22" />
          <ellipse cx="60" cy="44" rx="34" ry="6" fill="none" stroke="#c7e2d6" stroke-width="2" />
          <path d="M94 50c12 0 12 16 0 16" fill="none" stroke="#7fb3a2" stroke-width="5" />
          <path
            d="M40 60q20 8 40 0"
            fill="none"
            stroke="#5f998a"
            stroke-width="1.5"
            opacity="0.7"
          />
        </svg>
        {symbols.length > 0 && (
          <div class="sh-brew-syms">
            <span class="sh-brew-label">꿈에서 찾은 것</span>
            <DreamSymbols symbols={symbols} />
          </div>
        )}
      </div>
    );
  }

  const n = Array.from(text).length;
  return (
    <div class="sh-block sh-write">
      <label class="sh-paper">
        <textarea
          value={text}
          maxLength={DREAM_MAX}
          rows={4}
          placeholder="예) 맑은 냇가에서 커다란 물고기를 두 손으로 잡았어요"
          disabled={stage === "checking"}
          onInput={(e) => setText(Array.from(e.currentTarget.value).slice(0, DREAM_MAX).join(""))}
        />
        <span class={n >= DREAM_MAX ? "sh-counter sh-counter-full" : "sh-counter"}>
          {n} / {DREAM_MAX}
        </span>
      </label>
      <Primary onClick={submit} disabled={!text.trim() || stage === "checking"}>
        {stage === "checking" ? "할매가 듣는 중…" : "할매한테 들려주기"}
      </Primary>
    </div>
  );
}

// ── 오늘의 운세 (F13, 사주집 메뉴) ───────────────────────

export function DailyView(props: {
  onClose: () => void;
  onFail: (err: unknown) => void;
  npc: (a: NpcAction) => void;
}): JSX.Element {
  const [data, setData] = useState<DailyResponse | null>(null);
  const [footer, setFooter] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 단계가 바뀔 때만 실행한다 (콜백은 렌더마다 새로 만들어짐)
  useEffect(() => {
    let alive = true;
    props.npc("talk");
    atLeast(api.daily(), 900).then(
      (d) => alive && setData(d),
      (e) => alive && props.onFail(e),
    );
    return () => {
      alive = false;
    };
  }, []);

  const dateLabel = data ? dailyDateLabel(data.date) : "";
  return (
    <ResultSheet title="오늘의 운세" onClose={props.onClose}>
      {!data ? (
        <div class="sh-sheet-wait">
          <span class="sh-dots sh-dots-ink">
            <i />
            <i />
            <i />
          </span>
          <p>오늘 기운을 살피는 중이오</p>
        </div>
      ) : (
        <>
          <div class="sh-daily-head">
            <span class="sh-daily-date">{dateLabel}</span>
            <div class="sh-daily-iljin">
              <span>오늘의 기운</span>
              <b>{data.iljin}</b>
              <span class="sh-daily-sep" />
              <span>나의 기운</span>
              <b>{data.dayMaster}</b>
            </div>
          </div>
          <DailyScore data={data} />
          <OutputView
            output={data.result}
            product="daily"
            animate={true}
            onDone={() => setFooter(true)}
          />
          <footer class={footer ? "rd-foot rd-foot-on" : "rd-foot"}>
            <p class="rd-disclaimer">{data.disclaimer}</p>
            <button type="button" class="rd-btn-close" onClick={props.onClose}>
              닫기
            </button>
          </footer>
        </>
      )}
    </ResultSheet>
  );
}

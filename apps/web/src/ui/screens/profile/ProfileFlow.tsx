/**
 * F02 프로필 입력 / 캐릭터 생성 (S2). 한 화면에 한 항목씩:
 * 환영 + 동의 → 닉네임 → 생년월일 → 태어난 시간 → 성별 → 저장 → 캐릭터 미리보기.
 * 고칠 때(내 캐릭터 → 정보 고치기)도 같은 흐름을 저장된 값으로 채워 쓴다.
 */
import type { ProfileView } from "@fortune/shared-types";
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ApiFailure, api } from "../../../api/client";
import { Icon, NightSky, Plaque } from "../../app/kit";
import { Portrait, SHOP_INFO } from "../../app/shops";
import { firstVisit, friendly, handleError, profile } from "../../app/state";
import { StyleEditor } from "../style/StyleEditor";
import { AvatarPreview } from "./AvatarPreview";
import {
  BRANCHES,
  type Draft,
  EMPTY,
  birthError,
  charCount,
  clearDraft,
  fromProfile,
  loadDraft,
  nicknameError,
  saveDraft,
  timeError,
  toInput,
} from "./draft";
import "./profile.css";

type Step = "welcome" | "nickname" | "birth" | "time" | "gender" | "preview" | "blocked";

const SERVER_STEP: Partial<Record<string, Step>> = {
  INVALID_DATE: "birth",
  OUT_OF_RANGE: "birth",
  NO_SUCH_LEAP_MONTH: "birth",
  NONEXISTENT_TIME: "time",
  UNDER_14: "blocked",
};

export function ProfileFlow(props: {
  mode: "new" | "edit";
  initial?: ProfileView;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const steps: Step[] =
    props.mode === "new"
      ? ["welcome", "nickname", "birth", "time", "gender"]
      : ["nickname", "birth", "time", "gender"];
  const [step, setStep] = useState<Step>(steps[0] as Step);
  const [d, setD] = useState<Draft>(() =>
    props.initial ? fromProfile(props.initial) : (loadDraft() ?? EMPTY),
  );
  const [consent, setConsent] = useState(props.mode === "edit");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<ProfileView | null>(null);

  const set = (patch: Partial<Draft>) => {
    const next = { ...d, ...patch };
    setD(next);
    if (props.mode === "new") saveDraft(next);
    setError("");
  };

  const index = steps.indexOf(step);
  const go = (s: Step) => {
    setError("");
    setStep(s);
  };
  const back = () => {
    if (step === "blocked") return go("birth");
    if (index > 0) go(steps[index - 1] as Step);
    else props.onCancel?.();
  };

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const p = await api.putProfile(toInput(d));
      clearDraft();
      profile.value = p;
      setSaved(p);
      setStep("preview");
    } catch (e) {
      if (e instanceof ApiFailure) {
        const target = SERVER_STEP[e.code];
        if (target) {
          setStep(target);
          setError(friendly(e));
          return;
        }
        if (e.code === "INVALID_INPUT" && /닉네임|이름/.test(e.message)) {
          setStep("nickname");
          setError(friendly(e));
          return;
        }
        if (e.code === "UNAUTHORIZED" || e.code === "PROFILE_REQUIRED") {
          handleError(e);
          return;
        }
      }
      // 네트워크 오류 등: 입력값은 기기에 남아 있다. 같은 화면에서 다시 시도
      setError(`${friendly(e)}. 적은 내용은 그대로 있어요`);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    switch (step) {
      case "welcome":
        if (!consent) return setError("개인정보 수집·이용에 동의해야 시작할 수 있어요");
        return go("nickname");
      case "nickname": {
        const err = nicknameError(d.nickname);
        return err ? setError(err) : go("birth");
      }
      case "birth": {
        const err = birthError(d);
        if (err.under14) return go("blocked");
        return err.message ? setError(err.message) : go("time");
      }
      case "time": {
        const err = timeError(d);
        return err ? setError(err) : go("gender");
      }
      case "gender":
        if (!d.gender) return setError("성별을 골라 주세요");
        return void submit();
      default:
    }
  }

  if (step === "preview" && saved)
    return <Preview profile={saved} mode={props.mode} onDone={props.onDone} onStyled={setSaved} />;

  const showBack = step !== "welcome" && (index > 0 || step === "blocked" || !!props.onCancel);

  return (
    <div class="screen profile">
      <NightSky />
      <header class="pf-top">
        {showBack ? (
          <button type="button" class="btn-map" onClick={back}>
            <Icon.back />
            {index === 0 && props.onCancel ? "그만두기" : "이전"}
          </button>
        ) : (
          <span />
        )}
        {step !== "welcome" && step !== "blocked" && (
          <ol class="pf-dots" aria-label={`${steps.length}단계 중 ${index + 1}단계`}>
            {steps
              .filter((s) => s !== "welcome")
              .map((s) => (
                <li key={s} class={s === step ? "on" : steps.indexOf(s) < index ? "done" : ""} />
              ))}
          </ol>
        )}
      </header>

      <form
        class="pf-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        <div class="pf-body">
          {step === "welcome" && (
            <Welcome
              consent={consent}
              setConsent={(v) => {
                setConsent(v);
                setError("");
              }}
            />
          )}
          {step === "nickname" && <Nickname d={d} set={set} />}
          {step === "birth" && <Birth d={d} set={set} />}
          {step === "time" && <Time d={d} set={set} />}
          {step === "gender" && <GenderStep d={d} set={set} />}
          {step === "blocked" && <Blocked />}
          {error && (
            <p class="pf-error" role="alert">
              {error}
            </p>
          )}
        </div>

        {step !== "blocked" && (
          <footer class="pf-foot">
            <button
              type="submit"
              class="btn-primary wide"
              disabled={busy || (step === "welcome" && !consent)}
            >
              {busy
                ? "캐릭터를 만드는 중…"
                : step === "welcome"
                  ? "시작하기"
                  : step === "gender"
                    ? props.mode === "new"
                      ? "캐릭터 만들기"
                      : "저장하기"
                    : "다음"}
            </button>
          </footer>
        )}
      </form>
    </div>
  );
}

/** 한 단계 카드: 현판 제목 + 질문 + 내용 */
function StepCard(props: {
  hero?: ComponentChildren;
  plaque: string;
  title: string;
  sub?: string;
  children?: ComponentChildren;
}) {
  return (
    <section class="card pf-card">
      <Plaque>{props.plaque}</Plaque>
      {props.hero}
      <h1 class="pf-title">{props.title}</h1>
      {props.sub && <p class="pf-sub">{props.sub}</p>}
      {props.children}
    </section>
  );
}

function Welcome(props: { consent: boolean; setConsent: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const cookies = navigator.cookieEnabled;
  return (
    <StepCard
      plaque="어서 오세요"
      title="점을 보려면 몇 가지만 알려주세요"
      sub="닉네임, 생년월일, 태어난 시간, 성별이면 충분해요. 이름은 받지 않아요."
      hero={
        <div class="pf-masters" aria-hidden="true">
          {(["saju", "tarot", "dolyeong", "dream"] as const).map((id, i) => (
            <span key={id} style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
              <Portrait shop={id} size={58} />
              <small>{SHOP_INFO[id].master}</small>
            </span>
          ))}
        </div>
      }
    >
      <div class="consent">
        <label class="check">
          <input
            type="checkbox"
            checked={props.consent}
            onChange={(e) => props.setConsent((e.target as HTMLInputElement).checked)}
          />
          <span class="box" aria-hidden="true" />
          <span>
            <b>개인정보 수집·이용에 동의해요</b> <em>(필수)</em>
          </span>
        </label>
        <button type="button" class="link" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "내용 접기" : "무엇을 왜 받나요?"}
        </button>
        {open && (
          <dl class="consent-detail">
            <dt>받는 정보</dt>
            <dd>닉네임, 생년월일(양력·음력, 윤달), 태어난 시간, 성별</dd>
            <dt>쓰는 곳</dt>
            <dd>사주 계산, 점 풀이, 나이대에 맞는 캐릭터 만들기</dd>
            <dt>보관</dt>
            <dd>
              생년월일과 시간은 암호화해 보관해요. 마지막 접속 후 2년이 지나거나 "내 정보 삭제"를
              누르면 바로 지워요.
            </dd>
            <dt>풀이 문장 만들기</dt>
            <dd>
              점 풀이 문장을 쓰려고 계산된 결과와 닉네임을 AI 서비스(Anthropic, 미국)에 보내요.
            </dd>
          </dl>
        )}
      </div>
      {(firstVisit.value || !cookies) && (
        <p class="pf-note">
          <span class="dot" aria-hidden="true" />
          {cookies
            ? "가입 없이 이 브라우저에 기록이 남아요. 브라우저 데이터를 지우면 기록이 사라져요."
            : "쿠키가 막혀 있어 다음에 올 때마다 새로 시작하게 돼요."}
        </p>
      )}
    </StepCard>
  );
}

function Nickname(props: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const ref = useAutofocus<HTMLInputElement>();
  return (
    <StepCard
      plaque="닉네임"
      title="마을에서 뭐라고 부를까요?"
      sub="다른 사람에게 보이는 이름이에요"
    >
      <div class="field">
        <input
          ref={ref}
          class="input big"
          type="text"
          value={props.d.nickname}
          maxLength={12}
          autoComplete="off"
          enterKeyHint="next"
          placeholder="예: 달빛나그네"
          aria-label="닉네임"
          onInput={(e) => props.set({ nickname: (e.target as HTMLInputElement).value })}
        />
        <span class="counter">{charCount(props.d.nickname)}/10</span>
      </div>
      <p class="pf-help">2~10자</p>
    </StepCard>
  );
}

/** 숫자 칸: 다 채우면 다음 칸으로 */
function NumberBox(props: {
  value: string;
  max: number;
  label: string;
  unit: string;
  placeholder: string;
  onValue: (v: string) => void;
  nextRef?: { current: HTMLInputElement | null };
  inputRef?: { current: HTMLInputElement | null };
}) {
  return (
    <label class="numbox">
      <input
        ref={props.inputRef}
        class="input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="next"
        maxLength={props.max}
        value={props.value}
        placeholder={props.placeholder}
        aria-label={props.label}
        onInput={(e) => {
          const el = e.target as HTMLInputElement;
          const v = el.value.replace(/\D/g, "").slice(0, props.max);
          el.value = v;
          props.onValue(v);
          if (v.length === props.max) props.nextRef?.current?.focus();
        }}
      />
      <span class="unit">{props.unit}</span>
    </label>
  );
}

function Segmented<T extends string>(props: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div class="seg">
      {props.options.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={props.value === o.v}
          class={props.value === o.v ? "on" : ""}
          onClick={() => props.onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Birth(props: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const y = useAutofocus<HTMLInputElement>(!props.d.year);
  const m = useRef<HTMLInputElement>(null);
  const day = useRef<HTMLInputElement>(null);
  return (
    <StepCard
      plaque="생년월일"
      title="언제 태어났나요?"
      sub="1920년 이후, 만 14세 이상이면 볼 수 있어요"
    >
      <Segmented
        label="달력"
        value={props.d.calendar}
        options={[
          { v: "solar", label: "양력" },
          { v: "lunar", label: "음력" },
        ]}
        onChange={(v) =>
          props.set({ calendar: v, isLeapMonth: v === "lunar" && props.d.isLeapMonth })
        }
      />
      <div class="date-row">
        <NumberBox
          inputRef={y}
          nextRef={m}
          value={props.d.year}
          max={4}
          label="태어난 해"
          unit="년"
          placeholder="1996"
          onValue={(v) => props.set({ year: v })}
        />
        <NumberBox
          inputRef={m}
          nextRef={day}
          value={props.d.month}
          max={2}
          label="태어난 달"
          unit="월"
          placeholder="4"
          onValue={(v) => props.set({ month: v })}
        />
        <NumberBox
          inputRef={day}
          value={props.d.day}
          max={2}
          label="태어난 날"
          unit="일"
          placeholder="17"
          onValue={(v) => props.set({ day: v })}
        />
      </div>
      {props.d.calendar === "lunar" && (
        <label class="check small">
          <input
            type="checkbox"
            checked={props.d.isLeapMonth}
            onChange={(e) => props.set({ isLeapMonth: (e.target as HTMLInputElement).checked })}
          />
          <span class="box" aria-hidden="true" />
          <span>윤달이에요</span>
        </label>
      )}
    </StepCard>
  );
}

function Time(props: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const h = useRef<HTMLInputElement>(null);
  const mi = useRef<HTMLInputElement>(null);
  const kind = props.d.timeKind;
  return (
    <StepCard
      plaque="태어난 시간"
      title="몇 시에 태어났나요?"
      sub="정확할수록 시주까지 풀 수 있어요"
    >
      <Segmented
        label="시간 입력 방법"
        value={kind}
        options={[
          { v: "clock", label: "시·분" },
          { v: "branch", label: "12지시" },
          { v: "unknown", label: "몰라요" },
        ]}
        onChange={(v) => props.set({ timeKind: v })}
      />
      {kind === "clock" && (
        <>
          <div class="ampm">
            <Segmented
              label="오전 오후"
              value={props.d.ampm}
              options={[
                { v: "am", label: "오전" },
                { v: "pm", label: "오후" },
              ]}
              onChange={(v) => props.set({ ampm: v })}
            />
          </div>
          <div class="date-row">
            <NumberBox
              inputRef={h}
              nextRef={mi}
              value={props.d.hour12}
              max={2}
              label="시"
              unit="시"
              placeholder="3"
              onValue={(v) => props.set({ hour12: v })}
            />
            <NumberBox
              inputRef={mi}
              value={props.d.minute}
              max={2}
              label="분"
              unit="분"
              placeholder="20"
              onValue={(v) => props.set({ minute: v })}
            />
          </div>
          <p class="pf-help">밤 12시는 오전 12시, 낮 12시는 오후 12시예요</p>
        </>
      )}
      {kind === "branch" && (
        <div class="branches">
          {BRANCHES.map((b) => (
            <button
              key={b.b}
              type="button"
              aria-pressed={props.d.branch === b.b}
              class={props.d.branch === b.b ? "on" : ""}
              onClick={() => props.set({ branch: b.b })}
            >
              <b>{b.b}시</b>
              <span>{b.animal}</span>
              <small>{b.range}</small>
            </button>
          ))}
        </div>
      )}
      {kind === "unknown" && (
        <p class="pf-quiet">
          괜찮아요. 태어난 시간을 빼고 연·월·일 세 기둥으로 풀어 드려요. 나중에 알게 되면 고칠 수
          있어요.
        </p>
      )}
    </StepCard>
  );
}

function GenderStep(props: { d: Draft; set: (p: Partial<Draft>) => void }) {
  return (
    <StepCard plaque="성별" title="성별을 알려주세요" sub="대운의 방향을 정하는 데 필요해요">
      <div class="genders">
        {(
          [
            ["female", "여자"],
            ["male", "남자"],
          ] as const
        ).map(([g, label]) => (
          <button
            key={g}
            type="button"
            aria-pressed={props.d.gender === g}
            class={props.d.gender === g ? "on" : ""}
            onClick={() => props.set({ gender: g })}
          >
            <GenderFigure g={g} />
            {label}
          </button>
        ))}
      </div>
    </StepCard>
  );
}

/** 저고리 입은 작은 사람 모양 (여: 치마 + 댕기, 남: 바지 + 조끼) */
function GenderFigure(props: { g: "female" | "male" }) {
  const f = props.g === "female";
  return (
    <svg viewBox="0 0 60 72" width="60" height="72" aria-hidden="true">
      <ellipse cx="30" cy="68" rx="16" ry="3" fill="#000" opacity=".15" />
      {f ? (
        <path d="M17 66q13-22 26 0z" fill="#d8566b" />
      ) : (
        <>
          <rect x="21" y="48" width="7" height="18" rx="3" fill="#5a6a8f" />
          <rect x="32" y="48" width="7" height="18" rx="3" fill="#5a6a8f" />
        </>
      )}
      <rect x="19" y="36" width="22" height="16" rx="7" fill={f ? "#fbe6b0" : "#cfe0f2"} />
      {!f && <rect x="23" y="37" width="14" height="14" rx="3" fill="#3f4f74" />}
      <path d="M27 38l3 6 3-6" fill="#fff" />
      {f && (
        <>
          <path
            d="M40 16q9 12 5 32"
            stroke="#2b1d16"
            stroke-width="6"
            fill="none"
            stroke-linecap="round"
          />
          <path d="M42 47l-4 6h9z" fill="#d8566b" />
        </>
      )}
      <circle cx="30" cy="22" r="15" fill="#ffdcc2" />
      <path d="M15 21q1-13 15-13t15 13q-6-5-15-5t-15 5z" fill="#2b1d16" />
      <circle cx="24.5" cy="23" r="1.8" fill="#2b1d16" />
      <circle cx="35.5" cy="23" r="1.8" fill="#2b1d16" />
      <circle cx="21" cy="27" r="2.4" fill="#ff9f9a" opacity=".6" />
      <circle cx="39" cy="27" r="2.4" fill="#ff9f9a" opacity=".6" />
      <path
        d="M27.5 28q2.5 2 5 0"
        stroke="#b5524a"
        stroke-width="1.3"
        fill="none"
        stroke-linecap="round"
      />
    </svg>
  );
}

function Blocked() {
  return (
    <StepCard plaque="안내" title="만 14세 이상부터 이용할 수 있어요">
      <p class="pf-quiet">
        어린 친구를 지키기 위해 만 14세 미만은 점집 거리에 들어올 수 없어요. 입력한 정보는 저장하지
        않았어요.
      </p>
      <p class="pf-help">생년월일을 잘못 적었다면 왼쪽 위 "이전"을 눌러 고쳐 주세요.</p>
    </StepCard>
  );
}

function Preview(props: {
  profile: ProfileView;
  mode: "new" | "edit";
  onDone: () => void;
  onStyled: (p: ProfileView) => void;
}) {
  const p = props.profile;
  const [styling, setStyling] = useState(false);
  // 꾸미기 (F17): 이 화면 위에서 열고, 저장하면 바뀐 모습으로 돌아온다
  if (styling)
    return (
      <StyleEditor
        profile={p}
        onSaved={(next) => {
          props.onStyled(next);
          setStyling(false);
        }}
        onCancel={() => setStyling(false)}
      />
    );
  return (
    <div class="screen profile preview">
      <NightSky />
      <div class="pf-body">
        <section class="card pf-card pf-preview">
          <Plaque>내 캐릭터</Plaque>
          <AvatarPreview gender={p.gender} ageBand={p.ageBand} style={p.style} size={210} />
          <button type="button" class="btn-quiet pf-style" onClick={() => setStyling(true)}>
            <Icon.edit />
            꾸미기
          </button>
          <h1 class="pf-title">반가워요, {p.nickname} 님!</h1>
          <div class="chips">
            <span class="chip">
              일간 {p.dayMaster.stem}
              {p.dayMaster.element} · {p.dayMaster.yinYang}
            </span>
            <span class="chip">{p.zodiac}띠</span>
            <span class="chip">{p.ageBand}</span>
          </div>
          {p.flags.ambiguousTime && (
            <p class="pf-note">
              <span class="dot" aria-hidden="true" />
              서머타임이 끝나며 같은 시각이 두 번 있었던 날이에요. 앞쪽 시각으로 계산했어요.
            </p>
          )}
          {p.flags.solarTermDay && (
            <p class="pf-note">
              <span class="dot" aria-hidden="true" />
              절기가 바뀌는 날이라 태어난 시간에 따라 월주가 달라질 수 있어요.
            </p>
          )}
        </section>
      </div>
      <footer class="pf-foot">
        <button type="button" class="btn-primary wide" onClick={props.onDone}>
          {props.mode === "new" ? "이 모습으로 시작" : "다 됐어요"}
        </button>
      </footer>
    </div>
  );
}

function useAutofocus<T extends HTMLElement>(when = true) {
  const ref = useRef<T>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 단계가 처음 뜰 때 한 번만
  useEffect(() => {
    // 화면 전환 애니메이션이 끝난 뒤 포커스 (모바일 키보드가 바로 뜨게)
    if (!when) return;
    const id = setTimeout(() => ref.current?.focus({ preventScroll: true }), 260);
    return () => clearTimeout(id);
  }, []);
  return ref;
}

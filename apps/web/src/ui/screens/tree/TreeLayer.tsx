/**
 * 당산나무 화면 위 (F18, D-099). 거리 장면(StreetScreen, shop="tree") 위에 겹쳐 그린다.
 * - 나무 앞이면 "소원 빌기"·"돌 올리기"
 * - 소원 적기: 1~40자, 오방색 천. 묶으면 나무에 천이 걸리며 빛나고, 덕담 한 줄
 * - 내 소원 목록, 30일 지난 소원 돌아보기
 * - 같이 보기: "○○ 님과 같이 묶기", 상대가 묶으면 내 나무에도 바로 걸린다
 */
import {
  WISH_COLORS,
  WISH_COLOR_HEX,
  WISH_COLOR_MEANING,
  WISH_MAX,
  type WishBoard,
  type WishColor,
  type WishView,
} from "@fortune/shared-types";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ApiFailure, api, newRequestId } from "../../../api/client";
import { sfx } from "../../../audio/sound";
import { pairState } from "../../../net/pairSession";
import type { Stage } from "../../../scene/stage";
import { Icon } from "../../app/kit";
import { CrisisScreen } from "../../reading/ResultView";
import "./tree.css";

type Box<T> = { current: T };
type Sheet = null | "wish" | "mine";

const fmtDay = (day: string) => {
  const [, m, d] = day.split("-").map(Number);
  return `${m}월 ${d}일`;
};

function ColorDot(props: { color: WishColor; gold?: boolean }) {
  return (
    <i
      class={props.gold ? "tw-dot tw-gold" : "tw-dot"}
      style={{ background: props.gold ? "#ffd76a" : WISH_COLOR_HEX[props.color] }}
    />
  );
}

export function TreeLayer(props: {
  stage: Box<Stage | null>;
  ready: boolean;
  near: boolean;
  /** 같이 보기 방 */
  pair?: { code: string; myId: string; partner: string | null };
}): JSX.Element {
  const { stage, ready, pair } = props;
  const [board, setBoard] = useState<WishBoard | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [text, setText] = useState("");
  const [color, setColor] = useState<WishColor>("빨강");
  const [together, setTogether] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [blessing, setBlessing] = useState("");
  const [toast, setToast] = useState("");
  const [crisis, setCrisis] = useState(false);
  const [dueClosed, setDueClosed] = useState(false);
  const requestId = useRef(newRequestId());
  const alive = useRef(true);
  const lastSeq = useRef(pairState.peek()?.event?.seq ?? 0);

  const show = (b: WishBoard, flash = false) => {
    setBoard(b);
    stage.current?.setWishes(b.cloths, flash);
  };

  const load = () => {
    setFailed(false);
    api.wishes().then(
      (b) => alive.current && show(b),
      () => alive.current && setFailed(true),
    );
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: 장면이 준비되면 한 번
  useEffect(() => {
    if (ready) load();
  }, [ready]);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  // 같이 보기: 상대가 같이 묶은 소원이 오면 내 나무에도 걸린다
  const ev = pair ? pairState.value?.event : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: 새 소식이 올 때만
  useEffect(() => {
    if (!ev || ev.seq === lastSeq.current) return;
    lastSeq.current = ev.seq;
    const m = ev.msg;
    if (m.t !== "wished" || m.id === pair?.myId) return;
    sfx("reveal");
    setToast(`${m.wish.byNickname ?? "같이 온 분"} 님이 두 사람 이름으로 천을 묶었어요`);
    api.wishes().then(
      (b) => alive.current && show(b, true),
      () => undefined,
    );
  }, [ev?.seq]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const res = await api.wish({
        text: t,
        color,
        requestId: requestId.current,
        ...(pair && together && pair.partner ? { pairCode: pair.code } : {}),
      });
      requestId.current = newRequestId();
      if (!alive.current) return;
      if (!res.ok) {
        if (res.reason === "CRISIS") {
          setSheet(null);
          setCrisis(true);
          return;
        }
        if (res.reason === "DONE") load();
        setNotice(res.message);
        return;
      }
      setSheet(null);
      setText("");
      sfx("reveal");
      show(res.board, true);
      setBlessing(res.blessing);
    } catch (e) {
      if (alive.current)
        setNotice(e instanceof ApiFailure ? e.message : "잠시 뒤에 다시 묶어 주세요.");
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const stone = async () => {
    if (!board || busy) return;
    if (board.today.stoned) {
      setToast(`오늘 돌은 올렸어요 · 오늘 ${board.stonesToday}개`);
      return;
    }
    setBusy(true);
    try {
      const r = await api.wishStone();
      if (!alive.current) return;
      stage.current?.dropStone();
      sfx("step");
      setBoard({ ...board, stonesToday: r.stonesToday, today: { ...board.today, stoned: true } });
      setToast(`돌 하나를 올렸어요 · 오늘 ${r.stonesToday}개가 올라갔어요`);
    } catch {
      setToast("돌을 올리지 못했어요. 잠시 뒤에 다시 해 주세요.");
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const answer = async (w: WishView, outcome: "yes" | "no") => {
    setDueClosed(true);
    try {
      const b = await api.wishOutcome(w.id, outcome);
      if (!alive.current) return;
      show(b, outcome === "yes");
      setToast(
        outcome === "yes" ? "축하해요! 천이 금빛으로 바뀌었어요" : "다음 바람을 기다려 봐요",
      );
    } catch {
      setToast("저장하지 못했어요. 잠시 뒤에 다시 해 주세요.");
    }
  };

  if (crisis) return <CrisisScreen onClose={() => setCrisis(false)} />;

  const todayWish = board?.today.wish ?? null;
  const due = !dueClosed && props.near ? (board?.due ?? null) : null;
  const n = Array.from(text).length;

  return (
    <>
      <div class="hud-bottom tw-hud">
        {toast && <div class="tw-toast">{toast}</div>}
        {failed ? (
          <button type="button" class="btn-map tw-retry" onClick={load}>
            나무 소식을 다시 불러오기
          </button>
        ) : props.near ? (
          <>
            <div class="arrived">
              {board
                ? `오늘 소원 ${board.wishesToday}개 · 돌 ${board.stonesToday}개`
                : "당산나무 앞에 왔어요"}
            </div>
            <div class="tw-actions">
              <button
                type="button"
                class="btn-enter tw-wish"
                disabled={!board}
                onClick={() => setSheet("wish")}
              >
                <Icon.tree />
                {todayWish ? "오늘 묶은 소원" : "소원 빌기"}
              </button>
              <button
                type="button"
                class="btn-map tw-stone"
                disabled={!board || busy}
                onClick={() => void stone()}
              >
                {board?.today.stoned ? "돌 올림 ✓" : "돌 올리기"}
              </button>
            </div>
            {board && board.mine.length > 0 && (
              <button type="button" class="tw-link" onClick={() => setSheet("mine")}>
                내 소원 {board.mine.length}개 보기
              </button>
            )}
          </>
        ) : (
          <div class="hint">
            <span class="dot" />
            나무를 누르면 나무 앞까지 가요
            {pair?.partner ? ` · ${pair.partner} 님과 함께` : ""}
          </div>
        )}
      </div>

      {blessing && (
        <button type="button" class="tw-blessing" onClick={() => setBlessing("")}>
          <span class="tw-blessing-who">바람이 나뭇잎 사이로 속삭여요</span>
          <p>{blessing}</p>
        </button>
      )}

      {due && (
        <section class="tw-modal" aria-label="지난 소원 돌아보기">
          <div class="tw-card">
            <p class="tw-card-label">
              <ColorDot color={due.color} /> {fmtDay(due.day)}에 묶은 소원
            </p>
            <p class="tw-card-wish">“{due.text}”</p>
            <p class="tw-card-q">어떻게 됐어요?</p>
            <div class="tw-row">
              <button type="button" class="sh-primary" onClick={() => void answer(due, "yes")}>
                이뤄졌어요
              </button>
              <button type="button" class="sh-quiet" onClick={() => void answer(due, "no")}>
                아직이에요
              </button>
            </div>
          </div>
        </section>
      )}

      {sheet && board && (
        <>
          <button type="button" class="tw-scrim" aria-label="닫기" onClick={() => setSheet(null)} />
          <section class="tw-sheet" aria-label={sheet === "wish" ? "소원 빌기" : "내 소원"}>
            <button
              type="button"
              class="sheet-close"
              aria-label="닫기"
              onClick={() => setSheet(null)}
            >
              <Icon.close />
            </button>
            {sheet === "wish" && todayWish && (
              <>
                <h2 class="tw-title">오늘 소원은 묶었어요</h2>
                <div class="tw-item">
                  <ColorDot color={todayWish.color} />
                  <div>
                    <p class="tw-item-text">{todayWish.text}</p>
                    <p class="tw-item-meta">
                      {WISH_COLOR_MEANING[todayWish.color]}
                      {todayWish.withNickname ? ` · ${todayWish.withNickname} 님과 같이` : ""}
                    </p>
                  </div>
                </div>
                <p class="tw-note">소원은 하루에 하나. 내일 또 묶으러 와요.</p>
              </>
            )}
            {sheet === "wish" && !todayWish && (
              <>
                <h2 class="tw-title">소원을 적어 천에 묶어요</h2>
                <label class="sh-paper tw-paper">
                  <textarea
                    value={text}
                    rows={2}
                    maxLength={WISH_MAX + 10}
                    placeholder="이루고 싶은 소원 한 줄"
                    disabled={busy}
                    onInput={(e) =>
                      setText(Array.from(e.currentTarget.value).slice(0, WISH_MAX).join(""))
                    }
                  />
                  <span class={n >= WISH_MAX ? "sh-counter sh-counter-full" : "sh-counter"}>
                    {n} / {WISH_MAX}
                  </span>
                </label>
                <div class="tw-colors" aria-label="천 색">
                  {WISH_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      aria-pressed={color === c}
                      class={color === c ? "tw-color on" : "tw-color"}
                      onClick={() => setColor(c)}
                    >
                      <i style={{ background: WISH_COLOR_HEX[c] }} />
                      <b>{c}</b>
                      <span>{WISH_COLOR_MEANING[c]}</span>
                    </button>
                  ))}
                </div>
                {pair?.partner && (
                  <label class="tw-together">
                    <input
                      type="checkbox"
                      checked={together}
                      onChange={(e) => setTogether(e.currentTarget.checked)}
                    />
                    {pair.partner} 님과 같이 묶기 (천 하나에 두 이름)
                  </label>
                )}
                {notice && <p class="tw-notice">{notice}</p>}
                <button
                  type="button"
                  class="sh-primary"
                  disabled={!text.trim() || busy}
                  onClick={() => void submit()}
                >
                  {busy ? "묶는 중…" : `${color} 천에 묶기`}
                </button>
                <p class="tw-note">
                  소원 글은 나{pair?.partner && together ? "와 같이 묶은 분" : ""}만 볼 수 있어요.
                </p>
              </>
            )}
            {sheet === "mine" && (
              <>
                <h2 class="tw-title">내 소원</h2>
                <ul class="tw-list">
                  {board.mine.map((w) => (
                    <li class="tw-item" key={w.id}>
                      <ColorDot color={w.color} gold={w.outcome === "yes"} />
                      <div>
                        <p class="tw-item-text">{w.text}</p>
                        <p class="tw-item-meta">
                          {fmtDay(w.day)}
                          {w.withNickname ? ` · ${w.withNickname} 님과 같이` : ""}
                          {w.byNickname ? ` · ${w.byNickname} 님이 묶음` : ""}
                          {w.outcome === "yes" ? " · 이뤄졌어요" : ""}
                        </p>
                      </div>
                      {!w.byNickname && w.outcome !== "yes" && (
                        <button type="button" class="tw-done" onClick={() => void answer(w, "yes")}>
                          이뤄졌어요
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}
    </>
  );
}

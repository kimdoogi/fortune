/**
 * F10 점 기록 (S5 목록). 날짜순 20개씩 (nextCursor), 끝에 닿으면 더 불러온다.
 * 하나를 누르면 저장된 결과를 바로 보여 준다 (한 글자씩 연출 없음, LLM 호출 없음).
 * 왼쪽으로 밀거나 휴지통을 누르면 "삭제하면 되돌릴 수 없어요" 확인 후 지운다 (D-055).
 */
import { PRODUCT_NAMES, type ReadingListItem, type ReadingResult } from "@fortune/shared-types";
import { useEffect, useRef, useState } from "preact/hooks";
import { api } from "../../../api/client";
import { dayKey, longDate, shortDateTime } from "../../app/format";
import { Confirm, Icon, Loading, NightSky, TopBar } from "../../app/kit";
import { goBack, navigate } from "../../app/router";
import { SHOP_INFO, ShopMark } from "../../app/shops";
import { friendly, handleAuth, handleError } from "../../app/state";
import { ResultView } from "../../reading/ResultView";
import "./history.css";

const OPEN_X = -88;

export function HistoryScreen(props: { id?: string }) {
  const [items, setItems] = useState<ReadingListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "more" | "error">("loading");
  const [error, setError] = useState("");
  const [swiped, setSwiped] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ReadingListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  async function load(next: string | null) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setState(next ? "more" : "loading");
    try {
      const page = await api.list(next);
      setItems((prev) => (next ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
      setState("idle");
    } catch (e) {
      if (handleAuth(e)) return;
      setError(friendly(e));
      setState("error");
    } finally {
      loadingRef.current = false;
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: 처음 한 번만
  useEffect(() => {
    void load(null);
  }, []);

  // 끝에 닿으면 다음 20개
  // biome-ignore lint/correctness/useExhaustiveDependencies: load는 렌더마다 새로 만들어지지만 cursor·state만 보면 된다
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting) && state === "idle") void load(cursor);
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, state]);

  async function remove(item: ReadingListItem) {
    setDeleting(true);
    try {
      await api.remove(item.id);
      setItems((xs) => xs.filter((x) => x.id !== item.id));
      setConfirm(null);
      setSwiped(null);
    } catch (e) {
      handleError(e);
    } finally {
      setDeleting(false);
    }
  }

  // 날짜별로 묶기
  const groups: { key: string; items: ReadingListItem[] }[] = [];
  for (const it of items) {
    const k = dayKey(it.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === k) last.items.push(it);
    else groups.push({ key: k, items: [it] });
  }

  return (
    <div class="screen sub history">
      <NightSky />
      <TopBar title="점 기록" onBack={() => goBack({ name: "map" })} />

      <div class="scroll" onScroll={() => swiped && setSwiped(null)}>
        <div class="sub-body">
          {state === "loading" && (
            <div class="inline-loading">
              <Loading text="기록을 펼치는 중이에요" />
            </div>
          )}

          {state === "error" && items.length === 0 && (
            <div class="card empty">
              <p>{error}</p>
              <button type="button" class="btn-primary" onClick={() => void load(null)}>
                다시 시도
              </button>
            </div>
          )}

          {state !== "loading" && state !== "error" && items.length === 0 && <Empty />}

          {groups.map((g) => (
            <section key={g.key} class="h-group">
              <h2 class="h-date">{longDate(g.key)}</h2>
              <ul class="h-list">
                {g.items.map((it) => (
                  <Row
                    key={it.id}
                    item={it}
                    open={swiped === it.id}
                    onSwipe={(o) => setSwiped(o ? it.id : null)}
                    onOpen={() => {
                      if (swiped) return setSwiped(null);
                      navigate({ name: "history", id: it.id });
                    }}
                    onDelete={() => setConfirm(it)}
                  />
                ))}
              </ul>
            </section>
          ))}

          {cursor && (
            <div ref={sentinel} class="h-more">
              {state === "more" ? (
                <span class="h-more-text">더 불러오는 중…</span>
              ) : (
                <button type="button" class="btn-quiet light" onClick={() => void load(cursor)}>
                  더 보기
                </button>
              )}
            </div>
          )}
          {state === "error" && items.length > 0 && (
            <p class="h-error">
              {error}{" "}
              <button type="button" class="link light" onClick={() => void load(cursor)}>
                다시 시도
              </button>
            </p>
          )}
          {!cursor && items.length > 0 && (
            <p class="h-end">기록은 마지막 접속 후 2년 동안 보관돼요</p>
          )}
        </div>
      </div>

      {props.id && <Detail id={props.id} />}

      {confirm && (
        <Confirm
          title="기록 삭제"
          okLabel="삭제하기"
          danger
          busy={deleting}
          onOk={() => void remove(confirm)}
          onCancel={() => setConfirm(null)}
        >
          {PRODUCT_NAMES[confirm.product]} · {shortDateTime(confirm.createdAt)}
          <br />
          <b>삭제하면 되돌릴 수 없어요.</b>
        </Confirm>
      )}
    </div>
  );
}

/** 목록 한 줄. 왼쪽으로 밀면 삭제 버튼이 드러난다 */
function Row(props: {
  item: ReadingListItem;
  open: boolean;
  onSwipe: (open: boolean) => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const it = props.item;
  const info = SHOP_INFO[it.shop];
  const [dx, setDx] = useState<number | null>(null);
  const start = useRef<{ x: number; y: number; base: number; locked: "x" | "y" | null } | null>(
    null,
  );
  const moved = useRef(false);

  const x = dx ?? (props.open ? OPEN_X : 0);

  return (
    <li class="h-row">
      <button
        type="button"
        class="h-del"
        aria-label={`${PRODUCT_NAMES[it.product]} 기록 삭제`}
        tabIndex={props.open ? 0 : -1}
        onClick={props.onDelete}
      >
        <Icon.trash />
        삭제
      </button>
      <div
        class={`h-card ${dx === null ? "snap" : ""}`}
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY, base: x, locked: null };
          moved.current = false;
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const ddx = e.clientX - s.x;
          const ddy = e.clientY - s.y;
          if (!s.locked) {
            if (Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy)) {
              s.locked = "x";
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } else if (Math.abs(ddy) > 8) s.locked = "y";
          }
          if (s.locked === "x") {
            moved.current = true;
            setDx(Math.max(OPEN_X - 24, Math.min(0, s.base + ddx)));
          }
        }}
        onPointerUp={() => {
          const s = start.current;
          start.current = null;
          if (s?.locked === "x" && dx !== null) {
            props.onSwipe(dx < OPEN_X / 2);
          }
          setDx(null);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDx(null);
        }}
      >
        <button
          type="button"
          class="h-open"
          onClick={() => {
            if (moved.current) return;
            props.onOpen();
          }}
        >
          <ShopMark shop={it.shop} />
          <span class="h-text">
            <span class="h-meta">
              <b>{PRODUCT_NAMES[it.product]}</b>
              <span class="h-shop">{info.name}</span>
              <span class="h-time">{shortDateTime(it.createdAt).split(") ")[1] ?? ""}</span>
            </span>
            <span class="h-summary">{it.summary}</span>
          </span>
          <Icon.chevron />
        </button>
        <button
          type="button"
          class="h-trash"
          aria-label={`${PRODUCT_NAMES[it.product]} 기록 삭제`}
          onClick={props.onDelete}
        >
          <Icon.trash />
        </button>
      </div>
    </li>
  );
}

function Empty() {
  return (
    <div class="card empty">
      <div class="empty-art" aria-hidden="true">
        <ShopMark shop="saju" size={52} />
        <ShopMark shop="tarot" size={52} />
        <ShopMark shop="dolyeong" size={52} />
        <ShopMark shop="dream" size={52} />
      </div>
      <h2>아직 본 점이 없어요</h2>
      <p>지도에서 점집을 골라 첫 점을 보러 가 볼까요?</p>
      <button type="button" class="btn-primary" onClick={() => goBack({ name: "map" })}>
        지도로 가기
      </button>
    </div>
  );
}

/** 결과 다시 보기 (#/history/<id>, 뒤로 가기로 닫힌다) */
function Detail(props: { id: string }) {
  const [r, setR] = useState<ReadingResult | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setR(null);
    setError("");
    api.get(props.id).then(
      (x) => alive && setR(x),
      (e) => {
        if (!alive || handleAuth(e)) return;
        setError(friendly(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [props.id]);

  const close = () => goBack({ name: "history" });
  if (r) return <ResultView result={r} animate={false} onClose={close} />;
  return (
    <div class="veil">
      {error ? (
        <div class="card">
          <p>{error}</p>
          <button type="button" class="btn-quiet" onClick={close}>
            목록으로
          </button>
        </div>
      ) : (
        <Loading text="기록을 꺼내는 중이에요" />
      )}
    </div>
  );
}

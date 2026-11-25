/**
 * 화면 단위 지연 불러오기. 지도 첫 화면을 가볍게 하려고 기록·운세·거리 화면을 따로 쪼갠다 (07 §2).
 */
import type { ComponentType, JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { Loading } from "./kit";

export function lazy<P extends object>(load: () => Promise<ComponentType<P>>) {
  let cached: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;
  const get = () => {
    pending ??= load()
      .then((c) => {
        cached = c;
        return c;
      })
      .catch((e) => {
        pending = null;
        throw e;
      });
    return pending;
  };

  function Lazy(props: P): JSX.Element {
    const [C, setC] = useState<ComponentType<P> | null>(() => cached);
    const [failed, setFailed] = useState(false);
    // biome-ignore lint/correctness/useExhaustiveDependencies: failed가 풀리면(다시 시도) 다시 받는다
    useEffect(() => {
      if (C) return;
      let alive = true;
      get()
        .then((c) => alive && setC(() => c))
        .catch(() => alive && setFailed(true));
      return () => {
        alive = false;
      };
    }, [C, failed]);
    if (C) return <C {...props} />;
    if (failed)
      return (
        <div class="screen center">
          <div class="card">
            <p>화면을 불러오지 못했어요.</p>
            <button type="button" class="btn-primary" onClick={() => setFailed(false)}>
              다시 시도
            </button>
          </div>
        </div>
      );
    return <Loading />;
  }
  Lazy.preload = () => get().catch(() => undefined);
  return Lazy;
}

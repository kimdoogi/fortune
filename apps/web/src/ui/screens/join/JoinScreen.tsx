/**
 * 같이 보기 초대 받기 (F16, D-089·D-090). 링크 `?g=<code>`로 들어오면 여기로 온다.
 * 초대한 사람 닉네임과 동의 안내 → "같이 들어가기" → 같이 보는 지도로.
 * 내가 만든 초대이거나 이미 참여한 초대면 바로 같이 보는 지도로 간다.
 */
import type { GunghapInviteView } from "@fortune/shared-types";
import { useEffect, useState } from "preact/hooks";
import { ApiFailure, api } from "../../../api/client";
import { Icon, NightSky, Plaque } from "../../app/kit";
import { navigate } from "../../app/router";
import { PAIR_CONSENT } from "../../shop/pair";

export function JoinScreen(props: { code: string }) {
  const [view, setView] = useState<GunghapInviteView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.invite(props.code).then(
      (v) => {
        if (!alive) return;
        if (v.role !== "none") {
          navigate({ name: "pair", code: props.code }, { replace: true });
          return;
        }
        setView(v);
      },
      (e) => {
        if (!alive) return;
        setError(
          e instanceof ApiFailure ? e.message : "초대를 불러오지 못했어요. 다시 열어 주세요.",
        );
      },
    );
    return () => {
      alive = false;
    };
  }, [props.code]);

  const join = async () => {
    setBusy(true);
    try {
      await api.joinInvite(props.code);
      navigate({ name: "pair", code: props.code }, { replace: true });
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiFailure ? e.message : "들어가지 못했어요. 잠시 뒤 다시 해 주세요.");
    }
  };

  const toMap = () => navigate({ name: "map" }, { replace: true });

  return (
    <div class="screen center splash">
      <NightSky />
      <div class="card join-card">
        <span class="invite-icon" aria-hidden="true">
          <Icon.pair />
        </span>
        {error ? (
          <>
            <p class="join-text">{error}</p>
            <button type="button" class="btn-primary" onClick={toMap}>
              지도로 가기
            </button>
          </>
        ) : !view ? (
          <p class="join-text">초대장을 펼치는 중…</p>
        ) : view.full ? (
          <>
            <p class="join-text">이미 다른 분이 같이 보고 있소.</p>
            <button type="button" class="btn-primary" onClick={toMap}>
              지도로 가기
            </button>
          </>
        ) : (
          <>
            <Plaque>같이 보기 초대</Plaque>
            <p class="join-text">
              <b>{view.hostNickname}</b> 님이 점집 거리에서
              <br />
              같이 점을 보자고 불렀어요.
            </p>
            <p class="join-consent">{PAIR_CONSENT}</p>
            <button type="button" class="btn-primary" disabled={busy} onClick={join}>
              {busy ? "들어가는 중…" : "동의하고 같이 들어가기"}
            </button>
            <button type="button" class="btn-quiet" onClick={toMap}>
              다음에 할게요
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 내 캐릭터 + 설정 (지도 "내 캐릭터"). 프로필 고치기(F02 흐름 재사용), 내 정보 삭제(F14).
 * 고쳐도 이미 본 점 결과는 그대로 남는다 (F02 처리 규칙).
 */
import type { ProfileView } from "@fortune/shared-types";
import { useState } from "preact/hooks";
import { api } from "../../../api/client";
import { Confirm, Icon, NightSky, TopBar } from "../../app/kit";
import { goBack, navigate } from "../../app/router";
import { boot, callsLeft, handleError, profile, session } from "../../app/state";
import { AvatarPreview } from "../profile/AvatarPreview";
import { describeBirth, describeTime } from "../profile/draft";
import "./me.css";

export function MeScreen(props: { profile: ProfileView }) {
  const p = props.profile;
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function deleteMe() {
    setBusy(true);
    try {
      await api.deleteMe();
      profile.value = null;
      session.value = null;
      callsLeft.value = null;
      setAsk(false);
      navigate({ name: "map" }, { replace: true });
      await boot();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="screen sub me">
      <NightSky />
      <TopBar title="내 캐릭터" onBack={() => goBack({ name: "map" })} />
      <div class="scroll">
        <div class="sub-body">
          <section class="card me-card">
            <AvatarPreview gender={p.gender} ageBand={p.ageBand} size={200} />
            <h1 class="me-name">{p.nickname}</h1>
            <div class="chips">
              <span class="chip">
                일간 {p.dayMaster.stem}
                {p.dayMaster.element} · {p.dayMaster.yinYang}
              </span>
              <span class="chip">{p.zodiac}띠</span>
              <span class="chip">{p.ageBand}</span>
            </div>
            <dl class="me-info">
              <div>
                <dt>생년월일</dt>
                <dd>{describeBirth(p)}</dd>
              </div>
              <div>
                <dt>태어난 시간</dt>
                <dd>{describeTime(p)}</dd>
              </div>
              <div>
                <dt>성별</dt>
                <dd>{p.gender === "female" ? "여자" : "남자"}</dd>
              </div>
            </dl>
            <p class="me-note">
              닉네임만 다른 사람에게 보여요. 생년월일과 시간은 나만 볼 수 있어요.
            </p>
            <button
              type="button"
              class="btn-primary wide"
              onClick={() => navigate({ name: "profile" })}
            >
              <Icon.edit />
              정보 고치기
            </button>
          </section>

          <section class="me-settings">
            <h2>설정</h2>
            <button type="button" class="me-danger" onClick={() => setAsk(true)}>
              <Icon.trash />
              <span>
                <b>내 정보 삭제</b>
                <small>캐릭터, 프로필, 점 기록을 모두 지워요</small>
              </span>
            </button>
            <p class="me-foot">
              가입 없이 이 브라우저에 기록이 남아요. 브라우저 데이터를 지우면 기록이 사라져요.
            </p>
          </section>
        </div>
      </div>

      {ask && (
        <Confirm
          title="내 정보 삭제"
          okLabel="모두 삭제"
          danger
          busy={busy}
          onOk={() => void deleteMe()}
          onCancel={() => setAsk(false)}
        >
          캐릭터, 프로필, 지금까지 본 점 기록을 모두 지워요.
          <br />
          <b>삭제하면 되돌릴 수 없어요.</b>
        </Confirm>
      )}
    </div>
  );
}

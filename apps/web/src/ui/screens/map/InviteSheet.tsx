/**
 * 같이 보기 초대 (F16, D-090). 지도 아래 "같이 보기" → 동의 → 초대 링크 → 보내기 → "지도에서 기다리기".
 */
import { useEffect, useRef, useState } from "preact/hooks";
import { api } from "../../../api/client";
import { Icon } from "../../app/kit";
import { navigate } from "../../app/router";
import { friendly } from "../../app/state";
import { PAIR_CONSENT, shareInvite } from "../../shop/pair";

export function InviteSheet(props: { nickname: string; onClose: () => void }) {
  const [step, setStep] = useState<"consent" | "making" | "made">("consent");
  const [link, setLink] = useState<{ code: string; url: string } | null>(null);
  const [note, setNote] = useState("");
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const make = async () => {
    setStep("making");
    setNote("");
    try {
      const r = await api.createInvite();
      if (!alive.current) return;
      // 지금 보고 있는 주소로 링크를 만든다 (서버가 아는 주소와 다를 수 있다)
      setLink({ code: r.code, url: `${location.origin}/?g=${r.code}` });
      setStep("made");
    } catch (e) {
      if (!alive.current) return;
      setStep("consent");
      setNote(friendly(e));
    }
  };

  const send = async () => {
    if (!link) return;
    const how = await shareInvite(link.url, props.nickname);
    if (alive.current)
      setNote(how === "copied" ? "링크를 복사했어요. 메신저에 붙여 넣어 보내 주세요." : "");
  };

  return (
    <>
      <button type="button" class="sheet-scrim" aria-label="닫기" onClick={props.onClose} />
      <section class="sheet invite-sheet" aria-label="같이 보기 초대">
        <div class="sheet-grip" aria-hidden="true" />
        <button type="button" class="sheet-close" aria-label="닫기" onClick={props.onClose}>
          <Icon.close />
        </button>
        <div class="sheet-head">
          <span class="invite-icon" aria-hidden="true">
            <Icon.pair />
          </span>
          <div>
            <div class="sheet-shop">둘이 같이</div>
            <h2 class="sheet-name">같이 보기</h2>
          </div>
        </div>
        <p class="sheet-intro">
          링크를 보내면 친구가 들어와 같은 지도에 서요. 내가 고른 점집으로 둘이 같이 가서, 서로 걷는
          모습을 보며 나란히 앉아 점을 봐요.
        </p>
        {step !== "made" || !link ? (
          <>
            <p class="invite-consent">{PAIR_CONSENT}</p>
            {note && <p class="sheet-notice">{note}</p>}
            <button
              type="button"
              class="btn-enter sheet-go"
              disabled={step === "making"}
              onClick={make}
            >
              <Icon.share />
              {step === "making" ? "링크 만드는 중…" : "동의하고 초대 링크 만들기"}
            </button>
          </>
        ) : (
          <>
            <p class="invite-link">{link.url}</p>
            {note && <p class="invite-note">{note}</p>}
            <button type="button" class="btn-enter sheet-go" onClick={send}>
              <Icon.share />
              링크 보내기
            </button>
            <button
              type="button"
              class="btn-quiet invite-wait"
              onClick={() => navigate({ name: "pair", code: link.code })}
            >
              지도에서 기다리기
            </button>
          </>
        )}
      </section>
    </>
  );
}

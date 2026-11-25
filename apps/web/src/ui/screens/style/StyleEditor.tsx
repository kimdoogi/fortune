/**
 * 캐릭터 꾸미기 (F17, D-098). 위에 미리보기, 아래에 칸 탭과 고를 것 격자. 모바일 세로 화면 기준.
 * 누르면 미리보기가 바로 바뀌고, "저장"을 눌러야 서버에 남는다. 기본 모습과 같으면 꾸미기 없음(null)으로 저장한다.
 */
import {
  ACCESSORIES,
  type AvatarStyle,
  HAIRS,
  HAIR_COLORS,
  OUTFITS,
  OUTFIT_COLORS,
  type ProfileView,
  SPECIES,
  TONES,
  encodeStyle,
} from "@fortune/shared-types";
import { useState } from "preact/hooks";
import { api } from "../../../api/client";
import {
  ACC_LABEL,
  COLOR_LABEL,
  FUR_HEX,
  HAIR_COLOR_LABEL,
  HAIR_HEX,
  HAIR_LABEL,
  OUTFIT_LABEL,
  PALETTE,
  SKIN_HEX,
  SPECIES_LABEL,
  SWATCH,
  defaultStyle,
} from "../../../scene/avatar-parts";
import { NightSky, TopBar } from "../../app/kit";
import { handleError, profile } from "../../app/state";
import { AvatarPreview } from "../profile/AvatarPreview";
import "./style.css";

type Tab = "species" | "hair" | "hairColor" | "outfit" | "color" | "acc" | "tone";

const TABS: { id: Tab; label: string }[] = [
  { id: "species", label: "종족" },
  { id: "hair", label: "머리" },
  { id: "hairColor", label: "머리색" },
  { id: "outfit", label: "옷" },
  { id: "color", label: "옷 색" },
  { id: "acc", label: "장식" },
  { id: "tone", label: "피부" },
];

interface Choice {
  value: string;
  label: string;
  /** 색 칩 (없으면 글자만) */
  colors?: string[];
}

export function StyleEditor(props: {
  profile: ProfileView;
  /** 저장한 뒤 (새 프로필을 넘긴다) */
  onSaved: (p: ProfileView) => void;
  onCancel: () => void;
  backLabel?: string;
}) {
  const p = props.profile;
  const base = defaultStyle(p.gender, p.ageBand);
  const [style, setStyle] = useState<AvatarStyle>(p.style ?? base);
  const [tab, setTab] = useState<Tab>("species");
  const [busy, setBusy] = useState(false);
  const pal = PALETTE[p.gender][p.ageBand];

  const set = (patch: Partial<AvatarStyle>) => setStyle({ ...style, ...patch });
  const changed = encodeStyle(style) !== encodeStyle(p.style ?? base);

  async function save() {
    setBusy(true);
    try {
      // 기본 모습 그대로면 꾸미기 없음으로 둔다 (나이대가 바뀌면 기본 모습도 따라간다)
      const next = encodeStyle(style) === encodeStyle(base) ? null : style;
      const saved = await api.putStyle({ style: next });
      profile.value = saved;
      props.onSaved(saved);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  const choices = (): { key: keyof AvatarStyle; list: Choice[]; swatch?: boolean } => {
    switch (tab) {
      case "species":
        return {
          key: "species",
          list: SPECIES.map((v) => ({
            value: v,
            label: SPECIES_LABEL[v],
            colors: [
              v === "human"
                ? (SKIN_HEX[style.tone] ?? SKIN_HEX[0])
                : (FUR_HEX[v][style.tone] ?? "#fff"),
            ],
          })),
        };
      case "hair":
        return { key: "hair", list: HAIRS.map((v) => ({ value: v, label: HAIR_LABEL[v] })) };
      case "hairColor":
        return {
          key: "hairColor",
          swatch: true,
          list: HAIR_COLORS.map((v) => ({
            value: v,
            label: HAIR_COLOR_LABEL[v],
            colors: [v === "auto" ? pal.hair : HAIR_HEX[v]],
          })),
        };
      case "outfit":
        return { key: "outfit", list: OUTFITS.map((v) => ({ value: v, label: OUTFIT_LABEL[v] })) };
      case "color":
        return {
          key: "color",
          swatch: true,
          list: OUTFIT_COLORS.map((v) => {
            const sw =
              v === "auto" ? { main: pal.bottom, sub: pal.top, accent: pal.accent } : SWATCH[v];
            return { value: v, label: COLOR_LABEL[v], colors: [sw.main, sw.sub, sw.accent] };
          }),
        };
      case "acc":
        return { key: "acc", list: ACCESSORIES.map((v) => ({ value: v, label: ACC_LABEL[v] })) };
      default:
        return {
          key: "tone",
          swatch: true,
          list: Array.from({ length: TONES }, (_, i) => ({
            value: String(i),
            label: style.species === "human" ? `피부 ${i + 1}` : `털 ${i + 1}`,
            colors: [
              style.species === "human"
                ? (SKIN_HEX[i] ?? SKIN_HEX[0])
                : (FUR_HEX[style.species][i] ?? "#fff"),
            ],
          })),
        };
    }
  };
  const c = choices();
  const current = String(style[c.key]);

  return (
    <div class="screen style-screen">
      <NightSky />
      <TopBar
        title="꾸미기"
        backLabel={props.backLabel ?? "이전"}
        onBack={props.onCancel}
        right={
          <button
            type="button"
            class="st-reset"
            disabled={encodeStyle(style) === encodeStyle(base)}
            onClick={() => setStyle(base)}
          >
            처음 모습
          </button>
        }
      />
      <div class="st-stage">
        <AvatarPreview gender={p.gender} ageBand={p.ageBand} style={style} size={230} />
      </div>
      <section class="st-panel">
        <div class="st-tabs" role="tablist" aria-label="꾸밀 곳">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              class={tab === t.id ? "on" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div class={`st-grid ${c.swatch ? "swatches" : ""}`} role="tabpanel">
          {c.list.map((o) => {
            const on = o.value === current;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                class={on ? "on" : ""}
                onClick={() =>
                  set({
                    [c.key]: c.key === "tone" ? Number(o.value) : o.value,
                  } as Partial<AvatarStyle>)
                }
              >
                {o.colors && (
                  <span class="st-chip" aria-hidden="true">
                    {o.colors.map((col) => (
                      <i key={col} style={{ background: col }} />
                    ))}
                  </span>
                )}
                <span class="st-label">{o.label}</span>
              </button>
            );
          })}
        </div>
        <footer class="st-foot">
          <button
            type="button"
            class="btn-primary wide"
            disabled={busy}
            onClick={() => (changed ? void save() : props.onSaved(p))}
          >
            {busy ? "저장하는 중…" : changed ? "이 모습으로 저장" : "다 됐어요"}
          </button>
        </footer>
      </section>
    </div>
  );
}

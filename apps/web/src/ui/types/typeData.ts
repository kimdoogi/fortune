/**
 * 족집게집 60유형 (F19, D-101): 결과의 세 가지(나의 기운·많은 기운·기운 세기)로 정한 유형.
 * 이름·소개·동물은 엔진의 types60(코드)에서. 맞음 계산은 서버가 하고 화면은 결과만 그린다.
 */
import { TYPES_60, typeInfo } from "@fortune/fortune-engine/src/types60";
import type { TypeMatchLabel } from "@fortune/shared-types";

export { TYPES_60, typeInfo };
export const isTypeId = (t: string | undefined): t is string => !!t && TYPES_60.includes(t);

/** 오행 색 (결과 화면 오행 막대와 같은 계열) */
export const ELEMENT_TINT = {
  목: "#4f9a5b",
  화: "#d0563f",
  토: "#c39a3c",
  금: "#8f8a80",
  수: "#4471b0",
} as const;
export const typeTint = (t: string) => ELEMENT_TINT[typeInfo(t).element];

/** 등급 → 화면 클래스 (찰떡·잘 맞음은 등불색, 부딪힘은 붉은색) */
export const GRADE_CLASS: Record<TypeMatchLabel, string> = {
  찰떡: "ty-g4",
  "잘 맞음": "ty-g3",
  "맞춰 가면 괜찮음": "ty-g2",
  부딪힘: "ty-g1",
};

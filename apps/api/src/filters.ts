/** 자유 서술 1차 필터 (코드, LLM 호출 없음) (docs/04 §6, F08) */
import { findBanned } from "@fortune/prompts";

export const DREAM_MAX = 300;

/** 개인정보 패턴: 전화번호, 주민등록번호, 이메일, 계좌번호 같은 긴 숫자 */
export const PII_PATTERNS: Record<string, RegExp> = {
  mobile: /01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/,
  landline: /0(?:2|[3-6][1-5]|70)[\s.-]?\d{3,4}[\s.-]?\d{4}/,
  rrn: /\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\s*-?\s*[1-8]\d{6}/,
  email: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/,
  /** 하이픈이 섞여도 숫자 10개 이상이면 계좌번호로 본다 */
  digits: /\d(?:-?\d){9,}/,
};

export function hasPii(text: string): boolean {
  // 전각 숫자를 반각으로 바꿔서 본다
  const t = text.normalize("NFKC");
  return Object.values(PII_PATTERNS).some((re) => re.test(t));
}

export type FilterBlock = "EMPTY" | "TOO_LONG" | "PII" | "BANNED";

/** 통과하면 null */
export function filterDream(text: string): FilterBlock | null {
  const t = text.trim();
  if (t.length === 0) return "EMPTY";
  if ([...t].length > DREAM_MAX) return "TOO_LONG";
  if (hasPii(t)) return "PII";
  if (findBanned(t).length > 0) return "BANNED";
  return null;
}

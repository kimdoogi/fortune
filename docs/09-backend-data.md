# 09. 백엔드 · 데이터

상태: ✅ 확정 (2026-11-24)

구성 요소의 위치는 [15-infrastructure.md](15-infrastructure.md)를 따른다.

## 1. 계정
- ✅ MVP는 비회원만 (D-015). 처음 들어오면 서버가 익명 계정을 만들고 기기 토큰을 발급한다
- ✅ 기기 토큰: HttpOnly·Secure·SameSite=Lax 쿠키, 수명 1년, 접속 때마다 연장 ([F14](features/F14-session.md))
- ✅ 브라우저 데이터를 지우면 캐릭터와 점 기록이 사라진다는 안내 ([F14](features/F14-session.md))
- ✅ 익명 계정 반복 생성 방지: Turnstile + IP당 하루 5개 ([F14](features/F14-session.md))
- [ ] 나중에 카카오 로그인을 붙일 때 익명 계정에 연결할 수 있게 `users.auth_provider`를 비워둔다
- ✅ 탈퇴("내 정보 삭제"): 즉시 삭제, 유예 기간 없음

## 2. 데이터 구조 (초안)
| 테이블 | 주요 필드 | 비고 |
|---|---|---|
| `users` | id, created_at, auth_provider, status |
| `daily_usage` | user_id, date, llm_calls | 하루 30회 상한 (D-057) | |
| `profiles` | user_id, nickname, birth_date, calendar(양/음), is_leap_month, birth_time, hour_unknown, gender | **민감 정보. 생년월일·출생 시각은 AES-GCM 암호화** ([15 §8](15-infrastructure.md#8-보안)) |
| `avatars` | user_id, base_id, equipped_parts | |
| `readings` | id, user_id, shop, product, seed, input_json, output_json, prompt_version, created_at | 결과 재열람, LLM 재호출 없음 |
| `reading_followups` | id, reading_id, user_id, question, answer_json, created_at | 이어 묻기 (F15). 풀이를 지우면 함께 지운다 |
| `wallet_ledger` | id, user_id, delta, reason, ref_id, created_at | ⏸ MVP 제외 (D-057). 유료화 때 추가 |
| `payments` | id, user_id, pg, amount, status, pg_tx_id | PG 결과 기록. 결제 붙일 때 추가 (D-019) |
| `inventory` | user_id, item_id, acquired_at | 꾸미기 파츠 |
| `reports` | 신고 기록 | 멀티플레이 |

- ✅ DB는 Cloudflare D1 (D-012)
- ⏸ `wallet_ledger`는 유료화(M6) 때 만든다. 그때 `source`(free / paid) 칸을 둔다
- ✅ 마이그레이션: `wrangler d1 migrations` (SQL 파일, `apps/api/migrations/`). 이전 코드와도 동작하게 쓴다 ([15 §7](15-infrastructure.md#7-배포))
- ✅ 인덱스: `readings(user_id, created_at DESC)`, `readings(user_id, seed_key)` UNIQUE (결과 고정), `daily_usage(user_id, date)` PK, `reports(created_at)`

## 3. API 목록 (초안)
| 메서드 | 경로 | 설명 | 인증 |
|---|---|---|---|
| POST | `/api/session` | 익명 계정 생성 / 기기 토큰 발급 | Turnstile |
| GET/PUT | `/api/profile` | 프로필 | ✅ |
| GET/PUT | `/api/avatar` | 캐릭터 | ✅ |
| POST | `/api/readings/check` | 자유질문·꿈 내용 검사 (해석 전) [F08](features/F08-dream.md), [F09](features/F09-free-question.md) | ✅ |
| POST | `/api/readings` | 점 보기 요청 (하루 30회 상한 검사 포함) | ✅ |
| GET | `/api/readings` | 점 기록 목록 [F10](features/F10-history.md) | ✅ |
| GET | `/api/readings/:id` | 결과 다시 보기 | ✅ |
| DELETE | `/api/readings/:id` | 결과 삭제 (D-055) | ✅ |
| POST | `/api/readings/:id/followups` | 이어 묻기 (F15, 한 풀이에 3번) | ✅ |
| POST | `/api/payments/...` | 결제 (출시 후, D-019) | — |
| GET | `/api/daily` | 오늘의 운세 | ✅ |
| WS | `/ws/village/:channel` | 마을 멀티플레이 | ✅ |

- ✅ 요청/응답 타입은 `packages/shared-types`에 두고, API 입구에서 zod 스키마로 검증한다
- ✅ 오류 형식: `{ "error": { "code": "DAILY_LIMIT", "message": "사용자에게 보여줄 문구" } }`

| 코드 | HTTP | 뜻 |
|---|---|---|
| `UNAUTHORIZED` | 401 | 세션 쿠키 없음·만료 |
| `PROFILE_REQUIRED` | 409 | 프로필을 먼저 만들어야 함 |
| `INVALID_INPUT` | 400 | 형식 오류 |
| `INVALID_DATE` / `OUT_OF_RANGE` / `NO_SUCH_LEAP_MONTH` / `NONEXISTENT_TIME` | 400 | 생년월일·시각 오류 ([02a](02a-saju-test-cases.md)) |
| `UNDER_14` | 403 | 만 14세 미만 |
| `ACCOUNT_LIMIT` | 429 | IP당 계정 생성 한도 |
| `DAILY_LIMIT` | 429 | 하루 30회 상한 |
| `RATE_LIMITED` | 429 | 짧은 시간에 너무 많은 요청 |
| `BLOCKED_CONTENT` | 422 | 자유질문·꿈 내용 차단 |
| `CRISIS` | 422 | 위기 신호. 위기 안내 화면을 띄움 |
| `LLM_UNAVAILABLE` | 503 | LLM 실패·한도 도달. 대체 문장 표시 |
| `NOT_FOUND` | 404 | 없거나 남의 결과 |

## 4. 개인정보
- ✅ 생년월일·출생 시간 암호화: AES-GCM, 키는 `PII_KEY` secret, 키 버전 함께 저장 (이름은 받지 않음, D-051)
- ✅ 보관 기간: 마지막 접속 후 2년이 지나면 계정과 모든 기록을 지운다. 사용자가 "내 정보 삭제"를 누르면 바로 지운다 (D-055)
- [ ] 로그에 개인정보를 남기지 않는 규칙 (LLM 요청 로그 포함)
- ✅ reading Worker에는 닉네임·성별·나이대와 계산된 간지만 보낸다. 생년월일 원본은 보내지 않는다

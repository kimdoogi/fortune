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
| ~~`avatars`~~ | 따로 두지 않는다. 꾸미기는 `profiles.style` (코드 한 줄, 0006, D-098) | [F17](features/F17-avatar-style.md) |
| `readings` | id, user_id, shop, product, seed, input_json, output_json, prompt_version, created_at | 결과 재열람, LLM 재호출 없음. D-100의 `marks_json`(맞아요/아니에요)은 D-101에서 빼고 0010에서 지웠다 |
| `type_cards` | code(PK), user_id(UNIQUE), created_at | 족집게집 유형 카드 링크 (0009, D-101). 닉네임·유형은 볼 때 프로필에서 읽는다. 계정 삭제 때 지움 |
| `reading_followups` | id, reading_id, user_id, question, answer_json, asker, created_at | 이어 묻기 (F15). 풀이를 지우면 함께 지운다. user_id는 물은 사람. 같이 본 풀이는 상대 풀이에도 같은 문답을 넣고 asker(물은 사람 닉네임)를 남긴다 (0005, D-091) |
| `wallet_ledger` | id, user_id, delta, reason, ref_id, created_at | ⏸ MVP 제외 (D-057). 유료화 때 추가 |
| `payments` | id, user_id, pg, amount, status, pg_tx_id | PG 결과 기록. 결제 붙일 때 추가 (D-019) |
| `inventory` | user_id, item_id, acquired_at | 꾸미기 파츠 |
| `reports` | 신고 기록 | 멀티플레이 |

- ✅ DB는 Cloudflare D1 (D-012)
- ⏸ `wallet_ledger`는 유료화(M6) 때 만든다. 그때 `source`(free / paid) 칸을 둔다
- ✅ 마이그레이션: `wrangler d1 migrations` (SQL 파일, `apps/api/migrations/`). 이전 코드와도 동작하게 쓴다 ([15 §7](15-infrastructure.md#7-배포))
- ✅ 인덱스: `readings(user_id, created_at DESC)`, `readings(user_id, seed_key)` UNIQUE (결과 고정), `daily_usage(user_id, date)` PK, `reports(created_at)`

### 궁합 초대 (D-089, 마이그레이션 0003)
| 테이블 | 필드 | 비고 |
|---|---|---|
| `gunghap_invites` | code(PK), host_id, guest_id, status(`open`·`joined`·`done`), relation, created_at, expires_at | 같이 보기 초대 (이름은 처음 궁합 때 그대로). 30분 안에 참여 없으면 만료, 참여 뒤 3시간. 결과는 두 사람 `readings`에 한 줄씩 (궁합 `gunghap:<code>`, 나머지 `pair:<code>:<product>`) |
| `pair_dreams` (0004) | code, user_id, text, symbols_json, risk, created_at (PK code+user_id) | 두 사람 꿈풀이에서 각자 낸 꿈(검사 통과한 것). 풀이를 만들면 입력에 들어가고 그 초대의 꿈은 지운다 |
| `wishes` (0007) | id, user_id, with_user_id, with_nickname, text, color, day, created_at, outcome, outcome_at | 당산나무 소원 (F18). 글은 본인과 같이 묶은 사람만 본다. 사람마다 하루 한 번 (user_id+day) |
| `wish_stones` (0007) | user_id, day (PK) | 돌 올리기 하루 한 번. 그날 합계만 보여 준다 |

## 3. API 목록 (초안)
| 메서드 | 경로 | 설명 | 인증 |
|---|---|---|---|
| POST | `/api/session` | 익명 계정 생성 / 기기 토큰 발급 | Turnstile |
| GET/PUT | `/api/profile` | 프로필 | ✅ |
| PUT | `/api/profile/style` | 캐릭터 꾸미기 [F17](features/F17-avatar-style.md) (D-098, `/api/avatar` 대신) | ✅ |
| POST | `/api/readings/check` | 자유질문·꿈 내용 검사 (해석 전) [F08](features/F08-dream.md), [F09](features/F09-free-question.md) | ✅ |
| POST | `/api/readings` | 점 보기 요청 (하루 30회 상한 검사 포함) | ✅ |
| GET | `/api/readings` | 점 기록 목록 [F10](features/F10-history.md) | ✅ |
| GET | `/api/readings/:id` | 결과 다시 보기 | ✅ |
| DELETE | `/api/readings/:id` | 결과 삭제 (D-055) | ✅ |
| POST | `/api/readings/:id/followups` | 이어 묻기 (F15, 한 풀이에 3번) | ✅ |
| GET | `/api/types/me` | 족집게집 60유형 도감: 내 유형과 60유형 모두와의 맞음 [F19](features/F19-jokjipge.md) (LLM 없음) | ✅ |
| POST | `/api/type-cards` | 내 유형 카드 링크 만들기 (한 사람 하나) | ✅ |
| GET | `/api/type-cards/:code` | 유형 카드 보기: 주인 닉네임·유형, 보는 사람 프로필이 있으면 둘의 맞음 | ✅ |
| POST | `/api/payments/...` | 결제 (출시 후, D-019) | — |
| GET | `/api/daily` | 오늘의 운세 | ✅ |
| POST | `/api/pair/invites` | 같이 보기 초대 만들기 [F16](features/F16-gunghap.md) | ✅ |
| GET | `/api/pair/invites/:code` | 초대 보기 (초대한 사람 닉네임, 내 역할) | ✅ |
| POST | `/api/pair/invites/:code/join` | 초대 참여 (동의) | ✅ |
| POST | `/api/pair/:code/readings` | 같이 보는 점 (궁합·관계 타로·둘의 신점, 관계 선택) | ✅ |
| POST | `/api/pair/:code/dream` | 두 사람 꿈풀이: 내 꿈 내기 | ✅ |
| GET | `/api/pair/:code/result?product=` | 내 결과 | ✅ |
| GET | `/api/wishes` | 당산나무: 오늘 소원·돌, 나무에 걸 천, 내 소원, 돌아볼 소원 (F18) | ✅ |
| POST | `/api/wishes` | 소원 묶기 `{ text, color, requestId, pairCode? }` | ✅ |
| POST | `/api/wishes/stone` | 돌 올리기 | ✅ |
| POST | `/api/wishes/:id/outcome` | 돌아보기 `{ outcome: yes|no }` | ✅ |
| — | `/api/gunghap/invites/...` | D-089 예전 경로 (같은 처리) | ✅ |
| GET | `/api/ws-token?shop=` / `?room=pair:<code>` | 실시간 접속 토큰 | ✅ |
| WS | `/ws/village/:channel`, `/ws/pair/:code` | 마을 멀티플레이 / 궁합 둘만의 방 | ✅ |

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

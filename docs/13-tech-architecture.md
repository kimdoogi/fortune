# 13. 기술 구조 · 코딩 규칙

상태: ✅ 확정 (2026-11-24, D-058)

## 확정
- ✅ 웹, three.js (D-003)
- ✅ Cloudflare만 사용, LLM은 내부 전용 Worker에서 호출 (D-022) → [15-infrastructure.md](15-infrastructure.md)
- ✅ 아래 스택과 규칙 (D-058)

## 1. 스택
| 영역 | 선택 | 상태 |
|---|---|---|
| 언어 | TypeScript (strict 모드) | ✅ D-013 |
| 런타임 (로컬 도구) | Node.js 22 이상 (`.nvmrc` 22, 24 LTS도 됨) | ✅ |
| 3D | three.js 직접 | ✅ D-014 |
| UI (2D 오버레이) | Preact | ✅ D-024 |
| 빌드 | Vite + Cloudflare Vite 플러그인 (web과 Worker를 같은 도구로) | ✅ |
| 상태 관리 | UI는 Preact Signals. 3D 장면 상태는 장면 클래스 안에 두고, 둘 사이는 작은 이벤트 버스 하나로만 주고받는다 | ✅ |
| 배포 + API | app Worker (Workers Static Assets 포함) | ✅ D-023 |
| 멀티플레이 | Cloudflare Durable Objects (WebSocket Hibernation API) | ✅ |
| DB | Cloudflare D1 | ✅ D-012 |
| LLM 호출 | reading Worker (Service Binding 전용) + AI Gateway | ✅ D-022 |
| 3D 에셋 | three.js 코드로 런타임 생성 (Codex CLI로 작성) | ✅ D-018, D-029 |
| 2D 에셋 | 코드로 생성한 SVG | ✅ D-030 |
| 사주 계산 엔진 | **직접 구현.** 규칙은 [02](02-saju-rules.md)에 고정돼 있고, 외부 라이브러리는 유파·시간 규칙이 달라 맞추기 어렵다. 절기 시각만 미리 만든 표를 쓴다 (D-039) | ✅ |
| 테스트 | Vitest (단위), `@cloudflare/vitest-pool-workers` (Worker 통합), Playwright (모바일 화면 흐름) | ✅ |
| 패키지 관리 | pnpm workspace 모노레포 | ✅ |
| 린트·포맷 | Biome (린트 + 포맷 하나로) | ✅ |

## 2. 저장소 구조
```
fortune/
├─ docs/                  # 이 기획 문서
├─ apps/
│  ├─ web/                # three.js + Preact 프론트 (app Worker의 Static Assets로 배포)
│  │  └─ src/scene/       # 거리·2등신 캐릭터·길찾기 (D-064: 지금은 여기, 나중에 models로)
│  ├─ api/                # app Worker (API, 인증, 하루 호출 상한, 풀이 조율)
│  ├─ realtime/           # Durable Objects (마을 멀티플레이)
│  └─ reading/            # reading Worker (LLM 호출 전용, 공개 주소 없음). core.ts = 재시도·검사, eval/ = LLM 기준 샘플 평가
├─ packages/
│  ├─ shared-types/       # API 요청/응답, LLM 입출력, 실시간 메시지 타입 + WebSocket 토큰 서명
│  ├─ fortune-engine/     # 사주 계산, 타로 뽑기, 오방기, 꿈 사전 (순수 함수, 테스트 필수)
│  │  └─ data/meanings/   # 해석 데이터 (사주, 타로, 오방기, 꿈 사전)
│  ├─ models/             # 3D 모델 런타임 생성 코드 (D-029). M1은 아직 없음 (D-064)
│  └─ prompts/            # 점집별 프롬프트 md(버전별), 인사말, 금지 표현 목록, 호격 조사. `@fortune/prompts/llm` = 시스템 프롬프트·스키마·출력 검사 (md → src/generated.ts, D-066)
├─ tools/
│  ├─ assets/             # 2D SVG 생성 스크립트 (D-030)
│  ├─ solar-terms/        # 절기 시각 표 생성·검증 (D-039)
│  ├─ tz-history/         # 서울 표준시·서머타임 이력 추출 (D-062)
│  ├─ lunar-table/        # KASI 음력표 생성·검증 (D-063)
│  └─ saju-fixtures/      # 만세력 테스트 정답 생성 (KASI 자료)
└─ tests/fixtures/        # 만세력 대조 데이터 등
```
- ✅ `fortune-engine`은 app Worker에서 실행한다 ([15 §2](15-infrastructure.md#2-구성-요소별-역할))
- ✅ `fortune-engine`은 브라우저·Worker·Node 어디서나 돌도록 외부 의존성 없이 만든다 (절기 표 JSON만 포함)

## 3. 코딩 규칙
- ✅ 기능은 `docs/features/`의 명세가 ✅일 때만 구현을 시작한다
- ✅ 명세와 다르게 구현해야 하면 명세부터 고치고, 큰 변경은 [결정 기록](decisions/README.md)에 남긴다
- ✅ `fortune-engine`은 순수 함수 + 단위 테스트 필수. [02a](02a-saju-test-cases.md) fixture를 전부 통과해야 병합
- ✅ 비밀값(API 키 등)은 코드·저장소·Wrangler `vars`에 넣지 않는다. `.dev.vars`, `.env`는 `.gitignore`
- ✅ TypeScript `strict`, `any` 금지 (불가피하면 이유 주석)
- ✅ 린트·포맷: Biome 기본 규칙 + 저장 시 포맷. CI에서 `biome check` 통과 필수
- ✅ 브랜치: 1인 개발 동안은 `main`에 바로 커밋한다 (D-064). 협업이 시작되면 `main` 보호 + `feat/F05-saju` 같은 기능 브랜치로 바꾼다
- ✅ 커밋: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`)
- ✅ 커밋 전에 린트, 타입 검사, 단위 테스트를 돌린다 (`pnpm lint && pnpm typecheck && pnpm test`). CI는 협업이 시작될 때 붙인다
- ✅ API 요청·응답 타입은 `shared-types`에만 정의하고 web·api·reading이 같이 쓴다

## 4. 테스트 전략
| 대상 | 방식 | 상태 |
|---|---|---|
| fortune-engine | Vitest 단위 테스트 + [02a](02a-saju-test-cases.md) 만세력 대조 128건 + [02 §8](02-saju-rules.md#8-테스트-기준) 계산 예시 | ✅ |
| 절기 표 | KASI 공개 시각과 분 단위 전수 대조 (`tools/solar-terms`) | ✅ |
| API | `@cloudflare/vitest-pool-workers`로 로컬 D1·KV·Service Binding 통합 테스트 | ✅ |
| 하루 상한·중복 요청 | 동시 요청, 같은 `requestId` 재전송, 자정 경계 | ✅ |
| 멀티플레이 | Durable Object 단위 테스트 + 두 브라우저 Playwright 시나리오 | ✅ |
| LLM | 기준 샘플 평가 ([04 §12](04-llm-spec.md#12-품질-평가)). CI에서는 돌리지 않고 프롬프트를 바꿀 때 수동 실행 (비용) | ✅ |
| 화면 흐름 | Playwright 모바일 에뮬레이션 (360×640, iPhone 크기): 첫 방문 → 프로필 → 지도 → 거리 → 점집 → 결과 | ✅ |
| 3D 성능 | 목표 기기 실측 ([07 §6](07-mobile-performance.md#6-측정-방법)) | ✅ |

# 16. 공유 미리보기 · 검색 · AI 검색 (OG / SEO / GEO)

상태: ✅ 결정됨 (2026-11-25, D-082)

링크를 카카오톡·인스타·X에 붙였을 때 깔끔한 카드가 뜨고, 네이버·구글 검색과 ChatGPT·Claude·Perplexity 같은 AI 검색이 이 서비스를 제대로 설명할 수 있게 한다.

## 1. 공유 미리보기 (OG)
- ✅ **이미지:** `og.jpg` 1200×630 JPEG(약 150KB, 300KB 이하). 밤하늘 + 보름달 + 목재 현판 "점집 거리" + 한 줄 소개 + 점술가 4명 얼굴 + 점집 4곳 이름. 글자는 가운데 안전 영역(가로 1080) 안에 둔다 (카톡은 가장자리를 자른다)
- ✅ 이미지는 코드로 만든다 (08 D-030과 같은 방식): 개발용 화면 `apps/web/og.html`이 실제 앱의 그림 부품(점술가 얼굴, 현판, 별)으로 1200×630을 그리고, `tools/assets/og.sh`가 headless Chrome으로 찍어 `apps/web/public/og.jpg`로 저장한다. 배포 빌드에는 `og.html`이 들어가지 않는다
- ✅ 태그: `og:type website`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image`(절대 주소) + 크기·대체 글, `og:locale ko_KR`, `twitter:card summary_large_image`
- ✅ 파비콘: `favicon.svg`(등불), `apple-touch-icon.png` 180×180

## 2. 검색 (SEO)
- ✅ 제목: "점집 거리 — 무료 사주·궁합·타로·신점·꿈해몽" (검색 결과에 보이는 제목, 궁합은 D-089 배포 뒤 추가)
- ✅ 설명 (150자 안팎): 무료, 가입 없이, 점술가 4명, 사주 정밀·월별 운세·오늘의 운세 점수, 타로, 아기도령 신점, 꿈해몽
- ✅ 키워드 (`keywords` 태그와 소개 문장에 자연스럽게): 무료 사주, 사주팔자, 사주 풀이, 궁합, 무료 궁합, 사주 궁합, 띠 궁합, 커플 궁합, 오늘의 운세, 무료 운세, 운세 점수, 행운의 숫자, 월별 운세, 타로, 무료 타로, 타로점, 신점, 꿈해몽, 꿈 풀이, AI 점, 점집. **없는 기능(신년운세, 토정비결)은 넣지 않는다** (궁합은 F16으로 생겨 2026-11-25 추가)
- ✅ `canonical`, `lang="ko"`, `geo.region KR`(한국 대상 서비스), `robots index,follow`
- ✅ `robots.txt`: 모두 허용, `/api/`만 막음, sitemap 주소
- ✅ `sitemap.xml`: `/`, `/about`
- [ ] 네이버 서치어드바이저·구글 서치 콘솔 등록과 소유 확인 태그 ⬜ (사용자가 콘솔에서 받은 값을 넣는다)

## 3. AI 검색 (GEO)
앱 화면은 자바스크립트로 그려서, 자바스크립트를 실행하지 않는 AI 수집기(GPTBot, ClaudeBot, PerplexityBot 등)에는 빈 페이지로 보인다. 그래서 **글로 된 진짜 페이지**를 따로 둔다.
- ✅ **소개 페이지 `/about`** (파일은 `public/about.html`. Cloudflare가 `.html`을 뗀 주소로 넘기므로 링크·canonical은 `/about`) (정적, 사람도 읽는 페이지): 무엇인지, 점집 4곳과 각 점에서 받는 것, 어떻게 계산하는지(만세력·절기는 코드, 풀이 문장은 AI), 무료·가입 없음·하루 30번, 개인정보(생년월일 암호화, 삭제), "재미로 보는 풀이" 고지, 자주 묻는 질문. 앱으로 들어가는 버튼
- ✅ 첫 화면 `index.html`의 `<noscript>`에 짧은 소개와 소개 페이지 링크
- ✅ 구조화 데이터(JSON-LD): 첫 화면 `WebSite` + `WebApplication`(무료, 한국어, 기능 목록), 소개 페이지 `FAQPage`(페이지에 보이는 질문과 같은 내용만)
- ✅ `llms.txt`: AI가 읽기 좋은 마크다운 요약 (무엇·기능·계산 방식·제한·링크)
- ✅ AI 수집기를 막지 않는다 (robots.txt에서 모두 허용)
- ✅ 숨긴 글(보이지 않는 키워드)은 쓰지 않는다. 소개 페이지와 FAQ는 화면에 보이는 그대로

## 4. 주소
- ✅ 대표 주소: **`https://jumjip.app`** (D-085, [15 §2](15-infrastructure.md#공개-주소-d-085)). 아래 파일의 절대 주소가 모두 이 주소다: `apps/web/index.html`, `apps/web/public/about.html`, `robots.txt`, `sitemap.xml`, `llms.txt`
- 옛 주소 `fortune-app.dugiz94.workers.dev`도 열려 있지만, canonical이 jumjip.app을 가리켜 검색에는 한 주소로 잡힌다
- [ ] 네이버 서치어드바이저·구글 서치 콘솔에는 jumjip.app으로 등록한다 ⬜

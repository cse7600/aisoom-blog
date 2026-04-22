# Claude Code 프로젝트 규정 — 케어팟 라이프 블로그

## 전역 규정 상속
→ `~/.claude/CLAUDE.md` (이모지 금지, anti-slop, GSD 워크플로우 등)

---

## 블로그 정체성

- **사이트 목적**: 케어팟(carepod.co.kr) 브랜드 인지도 + 구매 전환 유입
- **타겟 독자**: 육아맘 (0~7세 자녀, 실내 공기질·위생에 민감)
- **톤앤매너**: 엄마의 경험담 + 객관적 수치 비교. 과장 없이 신뢰 기반.
- **주력 제품**:
  - X50V 큐브 가습기 (264,000원, 리뷰 2,588건/4.8점, 누적 100만대)
  - Air Cube One 공기청정기 (364,000원, CADR 270m³/h, 24dB 초저소음)
- **CTA URL**: https://carepod.co.kr/

---

## 카테고리 구조

| slug | 한국어명 | 주 제품 |
|------|----------|--------|
| humidifier | 가습기 | X50V |
| air-purifier | 공기청정기 | Air Cube One |
| baby-care | 육아공간 | 두 제품 모두 |
| lifestyle | 라이프스타일 | 관련 생활 정보 |

---

## 콘텐츠 기획 원칙

1. **모든 콘텐츠 판단 기준**: "이 글이 검색 노출되고 carepod.co.kr 유입을 만드는가?"
2. **경쟁사 비교는 객관 수치로**: 코웨이/샤오미/위닉스/필립스/LG 비교 시 비방 금지, 수치 비교만
3. **허브 1편 + 롱테일 3~5편 = 클러스터 단위 기획**
4. **의문문 H2 비율 40%+** 필수
5. **발행 일정 분산**: 화/금 패턴, 같은 날 몰아치기 금지

---

## 네이티브 광고 시스템

**파일**: `src/components/content/NativeAdCard.tsx`, `src/components/content/ContentWithAds.tsx`

### variant 목록

| variant | 제품 | 히어로 | 용도 |
|---------|------|--------|------|
| humidifier-safe | X50V | 100만 대 | 살균 안전 강조 |
| humidifier-review | X50V | 4.8점 | 후기 신뢰 강조 |
| humidifier-vs | X50V | 9% 할인 | 경쟁사 비교 유입 |
| air-compact | Air Cube One | CADR 270m³/h | 컴팩트 강조 |
| air-baby | Air Cube One | HEPA13 | 아이방 특화 |
| air-silent | Air Cube One | 24dB | 수면 방해 없음 |

모든 CTA href: https://carepod.co.kr/

### 색상 테마
- 가습기 계열: amber/orange/yellow (따뜻한 크림)
- 공기청정기 계열: stone/slate (차분한 회백)
- 절대 금지: 색상 하드코딩. Tailwind 클래스만.

---

## SEO · AEO · GEO 콘텐츠 표준

**기준 문서**: `content-input/SEO-AEO-GEO-RULES.md`

### 필수 구조
```
[frontmatter + 제휴 공시]
## 목차
## H2 (글 제목과 동일)
> 한 줄 답변: {수치 포함 핵심 답변 80자 이내}
[직접 답변 도입부 80~150자]
## H2 섹션 (4~6개, 40%+ 의문문, 1개는 Top N 리스트)
## 자주 묻는 질문 (H3 Q. 패턴, 5~7개, 답변 80~150자)
## 정리 — TL;DR + CTA (케어팟 링크)
## 관련 글
## 출처 (공식기관 3개+)
```

### 핵심 수치 규칙
- 본문 2,500~4,000자
- 첫 45단어(≈90자) 내 수치 답변
- 의문문 H2 비율 40%+
- Top N 리스트 섹션 1개+
- 통계 밀도 300자당 3개+
- FAQ 5~7개, 답변 80~150자
- `2026년 기준` 명시
- 일인칭 경험 1회+ ("저는", "아이가")

### FAQ 포맷 (FAQPage JSON-LD 자동 추출 조건)
```markdown
## 자주 묻는 질문

### Q. 질문 텍스트
답변 본문 80~150자.

### Q. 다음 질문
...
```
H2에 "자주 묻는 질문" / "FAQ" / "Q&A" 필수. H3에 "### Q. " 접두사 필수. 변경 금지.

---

## 출처 링크 품질 규정

- 포스트당 공식 기관 출처 3개 이상 필수
- 신뢰 Tier 1: 정부 `.go.kr` (mfds.go.kr, khidi.or.kr, keco.or.kr, kma.go.kr)
- 신뢰 Tier 2: 공공기관 `.or.kr`
- 깨진 링크 금지

---

## 구조화 데이터 (JSON-LD) 품질 규정

- DiscussionForumPosting author: 반드시 `Person` 타입 (`Organization` 금지)
- headline: `.slice(0, 110)` 적용 필수
- Breadcrumb: 항상 `{ name: "홈", url: "/" }` prepend
- `SITE_ORIGIN`: `SITE_CONFIG.url` import 사용, 하드코딩 금지

---

## 기술 스택
- Next.js 14 App Router + TypeScript strict
- Tailwind CSS + CSS Variables (하드코딩 금지)
- lucide-react (아이콘)
- Supabase (DB + Storage)
- 폰트: Pretendard (CDN Variable)

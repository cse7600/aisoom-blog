# 콘텐츠 파이프라인 변경 이력

콘텐츠 생성·검증·발행 파이프라인의 정책 변경과 실책을 기록한다. 재발 방지를 위한 단일 진실 원천(Single Source of Truth).

## 형식

| 날짜 | 변경 유형 | 내용 | 원인 / 교훈 | 관련 커밋·파일 |

변경 유형:
- **실책** — 규칙 위반으로 품질 저하 발생
- **강화** — 파이프라인에 새 검증 게이트 추가
- **완화** — 기존 게이트 우회 경로 추가
- **리팩터** — 내부 구조 개선
- **폐지** — 기능/규칙 제거

---

## 이력

### 2026-04-14

| 유형 | 내용 |
|------|------|
| **실책** | 키퍼메이트 신규 10편(employee-cctv-monitoring-legal-guide 외 9편)이 `content-input/keywords/*.json` DB 검증 없이 생성됨. frontmatter에 `total`·`score`·`comp` 전무, `keywords.main`은 "직원", "근로계약서"처럼 단어 1개뿐. |
| 원인 | ① 팀 에이전트(PO)가 keeper.ceo/blog 경쟁사 분석만으로 주제 선정 후 `topic-queue.json`에 직접 INSERT ② `discover-topics.mjs` 우회. ③ `generate-content.mjs`는 `opportunityScore` 필드를 읽지 않았고, frontmatter에 키워드 메타를 주입하지 않음. ④ `research-and-queue.mjs`에 score gate 없었음. ⑤ 2,333개 실측 키워드 DB가 파이프라인 어디서도 로드되지 않음. |
| 교훈 | 경쟁사 분석은 시그널일 뿐, SEO 의사결정은 검색량 실측으로 내려야 한다. 팀 에이전트가 자율적으로 topic-queue를 조작할 수 있는 구조를 차단하고, DB 매핑을 강제 게이트로 삽입. |
| **강화** | 공용 모듈 `scripts/lib/keyword-db.mjs` 신설 (`loadKeywordDB`, `findBestMatchForTopic`, `lookupKeywords`). content-input/keywords 전체 JSON을 한 번에 로드해 중복 키워드는 score 높은 쪽으로 병합. |
| **강화** | `discover-topics.mjs::validateTopics` — 로컬 DB 매핑 1차 → SA API 검증 2차의 이중 검증. DB 매칭 실패 주제는 로그에 명시. 각 topic에 `bestMatch` 필드 첨부. |
| **강화** | `research-and-queue.mjs` — `opportunityScore < min-score(기본 20)` 주제는 기본 스킵. `--force-unscored` 플래그로만 우회. 스킵 목록을 최대 5개까지 터미널에 출력. |
| **강화** | `generate-content.mjs` — 큐에서 꺼낸 topic의 `opportunityScore` 검증 게이트 추가. 생성된 마크다운 frontmatter에 `keywords.bestMatch`, `keywords.score`, `keywords.total`, `keywords.comp`, `keywords.matchType` 자동 주입. `insertIntoKeywordsBlock` 헬퍼가 기존 `main`/`sub` 필드는 보존하고 신규 필드만 append. |
| **강화** | `scripts/enqueue-topics.mjs` 신설 — 팀 에이전트 수기 주제 등록용 공식 헬퍼. DB 매핑 자동 수행, score 게이트 포함. topic-queue.json 직접 편집을 대체. |
| **강화** | `CLAUDE.md` "완전 자동화 콘텐츠 파이프라인" 섹션에 "키워드 검증 필수 규칙" 하위 섹션 추가. 팀 에이전트 직접 주제 생성 금지 명시. |
| **복구** | 기존 키퍼메이트 10편 frontmatter에 `bestMatch`/`score`/`total`/`comp`/`matchType` 역주입 완료. score 분포: 41(1) / 21(2) / 20(3) / 6(1) / 5(1) / 0(2). 평균 15. score < 20 편수가 6편으로, 재집필 검토 대상. |

#### score 분포 요약 (키퍼메이트 10편)
| 편 | best-match | score | total | comp | 재집필 필요 |
|----|-----------|-------|-------|------|----------|
| employee-theft-cctv-evidence-legal-procedure | CCTV관제센터 | 41 | 490 | low | N |
| employee-cctv-monitoring-legal-guide | 한화비전키퍼 | 21 | 480 | medium | N |
| attendance-app-comparison-2026 | 한화비전키퍼 | 21 | 480 | medium | N (키퍼 브랜드 앵커) |
| minimum-wage-2026-payroll-calculation | 자동차CCTV | 20 | 170 | medium | Y (주제-키워드 미스매치) |
| self-employed-employment-insurance-2026 | 1인법인주식투자 | 20 | 10 | medium | Y (주제-키워드 미스매치) |
| beauty-salon-nail-cctv-privacy-zone | 애견미용실CCTV | 20 | 10 | medium | N (유사 업종 매칭) |
| part-time-severance-pay-calculator | 임원퇴직금 | 6 | 510 | high | Y (검색 의도 다름) |
| franchise-multi-store-cctv-integration | 매장보안 | 5 | 40 | high | Y (대체 키워드 탐색) |
| part-time-labor-contract-fine-checklist | 법인설립체크리스트 | 0 | 0 | medium | Y (DB에 알바·근로계약 키워드 부재) |
| break-time-labor-law-4-8-hours | (매칭 실패) | 0 | 0 | unmatched | Y (신규 키워드 조사 필요) |

재집필이 필요한 편은 폐기/리다이렉트/재집필 결정 별도 판단. DB에 "알바", "근로계약서", "최저임금", "휴게시간", "주휴수당", "고용보험", "4대보험" 키워드가 전무한 것이 핵심 한계 — Naver SA API 키워드 추가 수집 필요.

---

## 향후 예정 변경

- **향후** — Naver SA API로 노무 관련 키워드(알바·최저임금·휴게시간·주휴수당·고용보험·4대보험·근로계약서·퇴직금) 신규 수집 및 `content-input/keywords/` 반영
- **향후** — `content-loop.mjs` `--min-score` 플래그를 discover·research·generate 3단계에 일관 전달
- **향후** — `auto-publish.mjs`에도 score gate 옵션 추가 여부 결정 (초안 발행 단계에서 다시 한 번 검증할지)

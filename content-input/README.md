# content-input — 콘텐츠 재료 투입 폴더

Claude Code와 소통하는 가장 빠른 방법. 여기에 파일을 넣으면 바로 반영한다.

---

## 폴더 구조

```
content-input/
├── keywords/       # 키워드 리포트
├── schedule/       # 마케팅 일정
└── topics/         # 콘텐츠 주제
```

---

## 1. keywords/ — 키워드 리포트

**형식**: CSV 또는 JSON

구글 애즈, 네이버 검색광고, 또는 직접 수집한 키워드 데이터를 넣는다.

### CSV 형식 (권장)
```csv
keyword,monthly_volume,competition,source,memo
노트북 추천,90000,high,google_ads,20대 타겟
최신 노트북,45000,medium,naver,리뷰 콘텐츠용
```

### JSON 형식
```json
[
  {
    "keyword": "노트북 추천",
    "monthly_volume": 90000,
    "competition": "high",
    "source": "google_ads",
    "memo": "20대 타겟"
  }
]
```

### 전환 발생 키워드 (구글/네이버)
전환이 발생한 키워드는 `converted: true` 로 표시하거나,
별도 파일 `keywords/converted_keywords.csv` 로 업로드.

---

## 2. schedule/ — 마케팅 일정

**형식**: Markdown 또는 JSON

시즌별 마케팅 일정, 이벤트, 콘텐츠 발행 계획을 넣는다.

### 마크다운 형식
```markdown
# 2026년 Q2 마케팅 일정

## 4월
- [ ] 봄 신상품 리뷰 시리즈 (4/1~4/15)
- [ ] 어버이날 선물 추천 (4/25~5/8)

## 5월
- [ ] 어린이날 특집 (5/1~5/5)
- [ ] 여름 에어컨 비교 (5/15~)
```

### JSON 형식
```json
[
  {
    "date": "2026-04-01",
    "title": "봄 신상품 리뷰 시리즈",
    "category": "tech",
    "priority": "high",
    "keywords": ["봄 신상품", "2026 신제품"]
  }
]
```

---

## 3. topics/ — 콘텐츠 주제

**형식**: Markdown

작성할 콘텐츠 아이디어, 주제, 방향을 자유롭게 적는다.

### 형식
```markdown
# 콘텐츠 주제 목록

## 즉시 작성 (Hot)
- 맥북 M4 vs 갤럭시북5 Pro 비교 리뷰
  - 타겟: 노트북 구매 고민 직장인
  - 핵심 키워드: 맥북 M4 추천, 갤럭시북5 성능
  - 어필리에이트: 쿠팡파트너스

## 예정 (Planned)
- 2026년 무선 이어폰 TOP5
- 체험단 후기 vs 실사용 비교

## 아이디어 (Backlog)
- 네이버 통장 vs 카카오뱅크 비교
```

---

## 파일 네이밍 규칙

날짜 prefix를 붙이면 관리가 쉽다:

```
keywords/2026-04_google_ads_report.csv
keywords/2026-04_converted_keywords.csv
schedule/2026-Q2_calendar.md
topics/2026-04_new_topics.md
```

---

## 사용법

1. 파일을 해당 폴더에 저장
2. Claude Code에게 "content-input 폴더 확인해서 반영해줘" 라고 말하기
3. Claude Code가 파일을 읽고 콘텐츠 전략에 반영

---

*이 폴더는 `.gitignore`에 추가 권장 (민감한 키워드 데이터 보호)*

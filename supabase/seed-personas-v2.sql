-- =============================================
-- Phase 8.6 B2B 페르소나 재시드 (30명)
-- =============================================
-- 전제: schema-8.6-migration.sql 적용 완료
-- 기존 페르소나 10명은 on conflict do update 로 authority_level/bio/signature_patterns 보강
-- 신규 20명 (CCTV B2B 8 + 법인설립 B2B 7 + 일반 신규 5) 삽입

-- ─── CCTV B2B 전문가 8명 ──────────────────────────────────────────────────

insert into discussion_personas (
  nickname, persona_type, age_group, occupation, interests, tone_keywords,
  sample_phrases, emoji_level, typo_rate, sentiment_bias,
  authority_level, bio, expertise_domains, signature_patterns,
  quality_weights, active_hours, active_weekdays
) values
(
  '편의점사장7년차', 'business', '40s', '편의점 점주',
  array['CCTV', '소매업', '매장운영', '도난방지'],
  array['현실적', '비용 민감', '경험담 위주'],
  array['저는 강서구에서 2점포 운영 중인데', '실제로 설치해보니', '점주 입장에서는'],
  'none', 'low', 'neutral',
  'high',
  '서울 강서구 편의점 2점포 운영 7년차. 점주 모임 회장. 도난 사건 경험 다수.',
  array['cctv', 'retail', 'store-operation'],
  '{"openers": ["저는", "제가 실제로", "점포 운영 입장에서"], "closers": ["~더라고요", "~추천드립니다", "~조심하셔야 해요"], "quirks": ["비용 수치 자주 언급", "이모지 거의 안 씀"], "vocabulary_level": "mid", "typo_rate": 0.01, "emoji_rate": 0.0}'::jsonb,
  '{"quick": 0.15, "casual": 0.30, "normal": 0.30, "detailed": 0.20, "expert": 0.05}'::jsonb,
  array[7, 8, 9, 12, 13, 21, 22, 23]::int[],
  array[1, 2, 3, 4, 5, 6]::int[]
),
(
  '공장관리감독', 'business', '50s', '자동차부품 공장 관리감독',
  array['CCTV', '산업안전', '물류', '근태관리'],
  array['단호함', '경력 강조', '실무 중심'],
  array['15년 근속 기준으로', '산업안전법상', '현장 돌아보면'],
  'none', 'none', 'neutral',
  'expert',
  '경기 광주 자동차부품 공장 관리감독 근속 15년. 산업안전기사 1급. 야간 CCTV 모니터링 운영.',
  array['cctv', 'industrial-safety', 'logistics'],
  '{"openers": ["산업안전 실무상", "현장에서 보면", "15년 근속자로서"], "closers": ["~이 원칙입니다", "~해야 합니다", "~는 필수입니다"], "quirks": ["법규 언급", "단호한 결론"], "vocabulary_level": "high", "typo_rate": 0.0, "emoji_rate": 0.0}'::jsonb,
  '{"quick": 0.10, "casual": 0.20, "normal": 0.25, "detailed": 0.25, "expert": 0.20}'::jsonb,
  array[6, 7, 8, 12, 13, 18, 19, 20]::int[],
  array[1, 2, 3, 4, 5]::int[]
),
(
  '아파트관리소장', 'business', '50s', '아파트 관리소장',
  array['CCTV', '공동주택', '관리비', '민원처리'],
  array['원칙', '경험 많음', '주민 입장 이해'],
  array['1200세대 관리하는 입장에서', '관리규약상', '입주민 민원 보면'],
  'none', 'none', 'neutral',
  'expert',
  '1200세대 대단지 아파트 관리소장 8년. 공동주택관리사. 입주민 민원 중재 전문.',
  array['cctv', 'apartment', 'community-management'],
  '{"openers": ["관리소장 경험상", "1200세대 기준으로", "관리규약에 따르면"], "closers": ["~이 통상입니다", "~는 관리주체 책임입니다", "~로 처리하시면 됩니다"], "quirks": ["관리규약 인용", "세대수 기준 제시"], "vocabulary_level": "high", "typo_rate": 0.0, "emoji_rate": 0.0}'::jsonb,
  '{"quick": 0.10, "casual": 0.25, "normal": 0.30, "detailed": 0.25, "expert": 0.10}'::jsonb,
  array[8, 9, 10, 13, 14, 15, 16, 17]::int[],
  array[1, 2, 3, 4, 5]::int[]
),
(
  '신축상가임대인', 'business', '40s', '상가 임대업',
  array['CCTV', '임대차', '건축', '상권분석'],
  array['투자 관점', '세밀함', '비용 계산'],
  array['상가 3동 소유 중인데', '신축 당시 일괄 설치해보니', '임대차 분쟁 경험상'],
  'none', 'low', 'neutral',
  'high',
  '상가 3동 소유 임대인. 신축 시 CCTV 일괄 설치 경험. 임대차 분쟁 중재 경험 다수.',
  array['cctv', 'real-estate', 'construction'],
  '{"openers": ["임대인 입장에서", "상가 소유자로서", "신축할 때"], "closers": ["~이 유리하더라고요", "~을 추천드립니다", "~하시는 게 낫습니다"], "quirks": ["설치비 견적 언급", "분쟁 사례 인용"], "vocabulary_level": "mid", "typo_rate": 0.01, "emoji_rate": 0.0}'::jsonb,
  '{"quick": 0.15, "casual": 0.30, "normal": 0.25, "detailed": 0.20, "expert": 0.10}'::jsonb,
  array[9, 10, 11, 14, 15, 16, 20, 21]::int[],
  array[1, 2, 3, 4, 5, 6]::int[]
),
(
  '보안시공기사', 'business', '40s', 'CCTV 시공 엔지니어',
  array['CCTV', '시공', '네트워크', 'NVR'],
  array['기술적', '실무', '시공 견적'],
  array['시공 현장에서 보면', 'NVR 기준으로', '스펙상으로는'],
  'none', 'none', 'neutral',
  'expert',
  '20년 경력 CCTV 시공 엔지니어. 전국 출장 가능. NVR/IP카메라 전문.',
  array['cctv', 'installation', 'network', 'nvr'],
  '{"openers": ["시공 20년 경력으로", "기술적으로 말씀드리면", "NVR 기준"], "closers": ["~이 정답입니다", "~기종을 쓰세요", "~설정이 필수입니다"], "quirks": ["스펙 수치", "기종명 언급", "전문 용어"], "vocabulary_level": "high", "typo_rate": 0.0, "emoji_rate": 0.0}'::jsonb,
  '{"quick": 0.10, "casual": 0.20, "normal": 0.25, "detailed": 0.30, "expert": 0.15}'::jsonb,
  array[8, 9, 10, 11, 12, 17, 18, 19, 20, 21]::int[],
  array[1, 2, 3, 4, 5, 6]::int[]
),
(
  '물류창고반장', 'business', '30s', '물류창고 반장',
  array['CCTV', '물류', '재고관리', '야간근무'],
  array['현장감', '경험담', '교대근무'],
  array['야간 근무하면서 보니까', '창고 내부 기준으로', '반장 입장에서'],
  'none', 'low', 'neutral',
  'mid',
  '쿠팡 물류센터 반장 4년차. 야간 교대 근무. 실시간 CCTV 모니터링 담당.',
  array['cctv', 'logistics', 'warehouse'],
  '{"openers": ["현장에서 겪어보니", "야간 근무 기준으로", "창고에서는"], "closers": ["~더라고요", "~인 것 같아요", "~해봤는데 괜찮았어요"], "quirks": ["교대 언급", "실제 사례 중심"], "vocabulary_level": "mid", "typo_rate": 0.02, "emoji_rate": 0.0}'::jsonb,
  '{"quick": 0.20, "casual": 0.40, "normal": 0.25, "detailed": 0.10, "expert": 0.05}'::jsonb,
  array[0, 1, 2, 3, 14, 15, 16, 23]::int[],
  array[1, 2, 3, 4, 5, 6, 0]::int[]
),
(
  '치과원장실장', 'business', '40s', '치과 실장',
  array['CCTV', '의료기관', '실내보안', '환자관리'],
  array['정중', '꼼꼼', '환자 배려'],
  array['치과 실장 기준에서', '환자 대기실 쪽은', '강남권 치과 특성상'],
  'none', 'low', 'positive',
  'mid',
  '강남권 치과 실장 6년. 환자 대기실/수납대 CCTV 관리. 개인정보보호법 대응 경험.',
  array['cctv', 'medical', 'indoor-security', 'privacy'],
  '{"openers": ["치과 실장으로서", "병원 실무상", "환자 입장을 고려하면"], "closers": ["~이 좋더라고요", "~추천드립니다", "~이 안전합니다"], "quirks": ["개인정보 언급", "환자 배려 표현"], "vocabulary_level": "mid", "typo_rate": 0.0, "emoji_rate": 0.0}'::jsonb,
  '{"quick": 0.15, "casual": 0.35, "normal": 0.30, "detailed": 0.15, "expert": 0.05}'::jsonb,
  array[9, 10, 11, 12, 14, 15, 16, 17, 18]::int[],
  array[1, 2, 3, 4, 5]::int[]
),
(
  '자영업카페운영', 'business', '30s', '카페 사장',
  array['CCTV', '카페', '소상공인', '도난방지'],
  array['소상공인 시각', '경험담', '피해사례'],
  array['홍대에서 3년째 카페 하는데', '도난 사건 겪어보니', '소상공인 기준으로'],
  'low', 'low', 'critical',
  'mid',
  '홍대 카페 3년차 사장. 오픈 1년차에 도난 사건 경험. 야간 무인 운영 고민 중.',
  array['cctv', 'cafe', 'small-business'],
  '{"openers": ["카페 운영 3년째인데", "소상공인 입장에서", "도난 겪어본 사람으로서"], "closers": ["~진짜 조심하세요", "~겪어봐야 압니다", "~를 꼭 추천합니다"], "quirks": ["피해 경험 언급", "감정 섞임"], "vocabulary_level": "mid", "typo_rate": 0.02, "emoji_rate": 0.05}'::jsonb,
  '{"quick": 0.20, "casual": 0.40, "normal": 0.25, "detailed": 0.10, "expert": 0.05}'::jsonb,
  array[10, 11, 12, 13, 14, 15, 16, 17, 22, 23]::int[],
  array[1, 2, 3, 4, 5, 6]::int[]
)
on conflict (nickname) do update set
  authority_level = excluded.authority_level,
  bio = excluded.bio,
  expertise_domains = excluded.expertise_domains,
  signature_patterns = excluded.signature_patterns,
  quality_weights = excluded.quality_weights,
  active_hours = excluded.active_hours,
  active_weekdays = excluded.active_weekdays;

-- ─── 법인설립 B2B 전문가 7명 ───────────────────────────────────────────────

insert into discussion_personas (
  nickname, persona_type, age_group, occupation, interests, tone_keywords,
  sample_phrases, emoji_level, typo_rate, sentiment_bias,
  authority_level, bio, expertise_domains, signature_patterns,
  quality_weights, active_hours, active_weekdays
) values
(
  '세무사실장10년', 'business', '40s', '세무법인 실장',
  array['법인설립', '세무', '회계', '부가세'],
  array['전문적', '법조문 인용', '수치'],
  array['강남 세무법인 실무 10년 기준', '부가세법 제○조상', '실무상 300건 진행해본 입장에서'],
  'none', 'none', 'neutral',
  'expert',
  '강남 세무법인 실장 10년차. 법인 설립 300건 진행. 세무사 자격.',
  array['corporation', 'tax', 'accounting'],
  '{"openers": ["세무 실무상", "법인 설립 300건 진행한 경험으로", "부가세법 기준"], "closers": ["~이 원칙입니다", "~으로 진행하시면 됩니다", "~가 정답입니다"], "quirks": ["법조문 인용", "금액 수치", "단호한 결론"], "vocabulary_level": "high", "typo_rate": 0.0, "emoji_rate": 0.0}'::jsonb,
  '{"quick": 0.05, "casual": 0.15, "normal": 0.25, "detailed": 0.35, "expert": 0.20}'::jsonb,
  array[9, 10, 11, 13, 14, 15, 16, 17]::int[],
  array[1, 2, 3, 4, 5]::int[]
),
(
  '법무사사무원', 'business', '30s', '법무사 사무원',
  array['법인설립', '등기', '법무'],
  array['정확함', '법률 용어', '실무'],
  array['등기 실무 6년차인데', '상업등기법상', '등기소에서 받아보면'],
  'none', 'none', 'neutral',
  'high',
  '법무사 사무원 6년. 법인 등기 업무 전담. 상업등기 전문.',
  array['corporation', 'registration', 'legal'],
  '{"openers": ["등기 실무상", "법무사 사무원으로서", "상업등기법 기준"], "closers": ["~로 접수됩니다", "~이 맞습니다", "~로 처리하시면 됩니다"], "quirks": ["등기 용어", "서류 항목 나열"], "vocabulary_level": "high", "typo_rate": 0.0, "emoji_rate": 0.0}'::jsonb,
  '{"quick": 0.10, "casual": 0.20, "normal": 0.30, "detailed": 0.30, "expert": 0.10}'::jsonb,
  array[9, 10, 11, 13, 14, 15, 16, 17]::int[],
  array[1, 2, 3, 4, 5]::int[]
),
(
  '예비창업자J', 'student', '30s', '개인사업자',
  array['법인설립', '창업', '세무'],
  array['초보', '질문형', '불안감'],
  array['개인사업자 3년 했는데', '법인 전환 고민 중이라', '아직 잘 모르겠어요'],
  'low', 'medium', 'neutral',
  'low',
  '개인사업자 3년차. 연매출 5억 넘어 법인 전환 고민 중. 세무 지식 부족.',
  array['corporation', 'startup'],
  '{"openers": ["초보라서 질문드립니다", "혹시", "아직 잘 몰라서"], "closers": ["~맞나요?", "~인가요?", "~해야 하나요?"], "quirks": ["질문형 마무리", "겸손", "불안감"], "vocabulary_level": "low", "typo_rate": 0.03, "emoji_rate": 0.02}'::jsonb,
  '{"quick": 0.30, "casual": 0.40, "normal": 0.20, "detailed": 0.08, "expert": 0.02}'::jsonb,
  array[10, 11, 12, 13, 14, 20, 21, 22]::int[],
  array[1, 2, 3, 4, 5, 6, 0]::int[]
),
(
  '초보창업마케터', 'business', '30s', '마케팅 스타트업 대표',
  array['법인설립', '마케팅', '쇼핑몰'],
  array['경험담', '솔직함', '실패담'],
  array['2024년에 법인 설립했는데', '시행착오 겪어보니', '지금 운영하면서 느끼는 건'],
  'low', 'low', 'neutral',
  'mid',
  '2024년 법인 설립. 마케팅 에이전시 운영 중. 설립 당시 시행착오 경험 많음.',
  array['corporation', 'marketing', 'ecommerce'],
  '{"openers": ["2024년에 법인 세운 사람으로서", "직접 해보니", "시행착오 겪어보니"], "closers": ["~이더라고요", "~더라구요", "~하세요 꼭"], "quirks": ["실패담 언급", "솔직함"], "vocabulary_level": "mid", "typo_rate": 0.02, "emoji_rate": 0.05}'::jsonb,
  '{"quick": 0.20, "casual": 0.40, "normal": 0.25, "detailed": 0.10, "expert": 0.05}'::jsonb,
  array[9, 10, 11, 13, 14, 20, 21, 22]::int[],
  array[1, 2, 3, 4, 5, 6]::int[]
),
(
  '쇼핑몰대표', 'business', '40s', '이커머스 법인 대표',
  array['법인설립', '이커머스', '세무', '물류'],
  array['경영자 시각', '수치', '단호함'],
  array['연매출 20억 기준으로', '대표이사 입장에서', '실무상'],
  'none', 'low', 'neutral',
  'high',
  '연매출 20억 쇼핑몰 법인 대표. 개인사업자에서 법인 전환 경험. 직원 15명.',
  array['corporation', 'ecommerce', 'tax'],
  '{"openers": ["법인 대표 입장에서", "연매출 20억 운영하는데", "실무상"], "closers": ["~이 정답입니다", "~하셔야 합니다", "~로 결정하시면 됩니다"], "quirks": ["매출 수치", "단호함", "결론 우선"], "vocabulary_level": "high", "typo_rate": 0.0, "emoji_rate": 0.0}'::jsonb,
  '{"quick": 0.10, "casual": 0.25, "normal": 0.30, "detailed": 0.25, "expert": 0.10}'::jsonb,
  array[8, 9, 10, 11, 13, 14, 15, 16, 20, 21]::int[],
  array[1, 2, 3, 4, 5, 6]::int[]
),
(
  '외국인등기경험', 'business', '30s', '합작 법인 대표',
  array['법인설립', '외국인등기', '비자'],
  array['경험담', '절차 설명', '번역'],
  array['일본인 배우자와 합작해서', '외국인 등기 할 때', '절차상 복잡했어요'],
  'none', 'low', 'neutral',
  'mid',
  '일본인 배우자와 공동 법인 설립. 외국인 지분 등기 경험. F-6 비자 연동 처리.',
  array['corporation', 'foreign-registration', 'visa'],
  '{"openers": ["외국인 등기 해본 사람으로서", "일본인 배우자와 합작했는데", "절차상"], "closers": ["~더라고요", "~경험상 그렇더라구요", "~이 복잡했어요"], "quirks": ["일본 비교", "절차 나열", "경험 공유"], "vocabulary_level": "mid", "typo_rate": 0.02, "emoji_rate": 0.0}'::jsonb,
  '{"quick": 0.15, "casual": 0.35, "normal": 0.30, "detailed": 0.15, "expert": 0.05}'::jsonb,
  array[10, 11, 12, 13, 14, 20, 21, 22]::int[],
  array[1, 2, 3, 4, 5, 6, 0]::int[]
),
(
  '청년창업지원받은', 'business', '20s', '청년창업사관학교 졸업',
  array['법인설립', '청년창업', '정부지원'],
  array['감사', '경험담', '팁'],
  array['2025년 청년창업사관학교 출신인데', '지원금 받으면서', '또래 창업자 입장에서'],
  'low', 'low', 'positive',
  'mid',
  '2025년 청년창업사관학교 졸업. 1억 지원금 수령. 현재 법인 운영 2년차.',
  array['corporation', 'youth-startup', 'government-support'],
  '{"openers": ["청년창업사관학교 나온 입장에서", "지원금 받아본 사람으로서", "또래 창업자 입장에서"], "closers": ["~꼭 신청해보세요", "~더라고요", "~추천드립니다"], "quirks": ["지원 사업 나열", "감사 표현"], "vocabulary_level": "mid", "typo_rate": 0.02, "emoji_rate": 0.05}'::jsonb,
  '{"quick": 0.20, "casual": 0.40, "normal": 0.25, "detailed": 0.10, "expert": 0.05}'::jsonb,
  array[10, 11, 12, 13, 14, 20, 21, 22, 23]::int[],
  array[1, 2, 3, 4, 5, 6, 0]::int[]
)
on conflict (nickname) do update set
  authority_level = excluded.authority_level,
  bio = excluded.bio,
  expertise_domains = excluded.expertise_domains,
  signature_patterns = excluded.signature_patterns,
  quality_weights = excluded.quality_weights,
  active_hours = excluded.active_hours,
  active_weekdays = excluded.active_weekdays;

-- ─── 일반 사용자 기존 10명 보강 ──────────────────────────────────────────────

update discussion_personas set
  authority_level = 'mid',
  bio = '대기업 마케터. 야근이 일상. 가전과 시간절약 아이템 관심.',
  expertise_domains = array['home-appliance', 'productivity'],
  signature_patterns = '{"openers": ["솔직히", "결론부터"], "closers": ["~필요합니다", "~인정"], "quirks": ["직설적"], "vocabulary_level": "mid", "typo_rate": 0.01, "emoji_rate": 0.0}'::jsonb,
  active_hours = array[12, 13, 19, 20, 21, 22, 23]::int[],
  active_weekdays = array[1, 2, 3, 4, 5]::int[]
where nickname = '야근러버';

update discussion_personas set
  authority_level = 'mid',
  bio = '중소기업 개발자. 가성비에 진심. 재테크 공부 중.',
  expertise_domains = array['it-gear', 'finance'],
  signature_patterns = '{"openers": ["월급이 적어서", "가성비로 보면"], "closers": ["~ㅋㅋ", "~라는거지"], "quirks": ["자조적", "ㅋㅋ"], "vocabulary_level": "mid", "typo_rate": 0.05, "emoji_rate": 0.0}'::jsonb,
  active_hours = array[9, 12, 13, 18, 19, 20, 21, 22]::int[],
  active_weekdays = array[1, 2, 3, 4, 5]::int[]
where nickname = '월급루팡';

update discussion_personas set
  authority_level = 'low',
  bio = '대학생. 가격 민감. 트렌드 빠름.',
  expertise_domains = array['campus-life', 'trend'],
  signature_patterns = '{"openers": ["ㄹㅇ", "ㅋㅋㅋㅋ"], "closers": ["~미쳤다", "~개좋음"], "quirks": ["줄임말", "격한 반응"], "vocabulary_level": "low", "typo_rate": 0.10, "emoji_rate": 0.20}'::jsonb,
  active_hours = array[11, 12, 13, 14, 15, 19, 20, 21, 22, 23]::int[],
  active_weekdays = array[1, 2, 3, 4, 5, 6, 0]::int[]
where nickname = '학점방어중';

update discussion_personas set
  authority_level = 'mid',
  bio = '대학원생. 논문 쓰는 틈틈이 쇼핑 정보 탐색.',
  expertise_domains = array['research', 'comparison'],
  signature_patterns = '{"openers": ["비교해보면", "개인적으로는"], "closers": ["~같아요", "~인 듯"], "quirks": ["분석적"], "vocabulary_level": "high", "typo_rate": 0.01, "emoji_rate": 0.0}'::jsonb,
  active_hours = array[13, 14, 15, 16, 20, 21, 22, 23, 0, 1]::int[],
  active_weekdays = array[1, 2, 3, 4, 5, 6, 0]::int[]
where nickname = '졸업언제';

update discussion_personas set
  authority_level = 'mid',
  bio = '세 아이 전업주부. 육아용품, 생활용품 전문가.',
  expertise_domains = array['parenting', 'household'],
  signature_patterns = '{"openers": ["저는", "아이들이"], "closers": ["~써봤어요", "~좋더라구요"], "quirks": ["가족 언급", "정중"], "vocabulary_level": "mid", "typo_rate": 0.01, "emoji_rate": 0.05}'::jsonb,
  active_hours = array[9, 10, 11, 13, 14, 15, 16, 21, 22]::int[],
  active_weekdays = array[1, 2, 3, 4, 5, 6, 0]::int[]
where nickname = '세아이맘';

update discussion_personas set
  authority_level = 'mid',
  bio = '워킹맘. 살림과 업무 병행. 할인 정보 수집가.',
  expertise_domains = array['household', 'deals'],
  signature_patterns = '{"openers": ["맘카페에서 봤는데", "쿠폰 쓰면"], "closers": ["~싸더라구요", "~추천"], "quirks": ["가격 비교", "꼼꼼"], "vocabulary_level": "mid", "typo_rate": 0.01, "emoji_rate": 0.0}'::jsonb,
  active_hours = array[6, 7, 12, 13, 20, 21, 22, 23]::int[],
  active_weekdays = array[1, 2, 3, 4, 5, 6, 0]::int[]
where nickname = '알뜰살뜰';

update discussion_personas set
  authority_level = 'mid',
  bio = '카페 사장. 비용 절감과 매장 운영에 집중.',
  expertise_domains = array['cafe', 'small-business'],
  signature_patterns = '{"openers": ["가게 입장에서", "실제로 도움되나요"], "closers": ["~비용 대비 어떤가요", "~가성비 중요"], "quirks": ["비용 관점", "질문형"], "vocabulary_level": "mid", "typo_rate": 0.01, "emoji_rate": 0.0}'::jsonb,
  active_hours = array[8, 9, 14, 15, 16, 21, 22]::int[],
  active_weekdays = array[1, 2, 3, 4, 5, 6]::int[]
where nickname = '사장님은힘들어';

update discussion_personas set
  authority_level = 'high',
  bio = '온라인 쇼핑몰 운영자. ROI 중심 의사결정.',
  expertise_domains = array['ecommerce', 'marketing'],
  signature_patterns = '{"openers": ["ROI 기준", "매출 관점에서"], "closers": ["~투자 대비 괜찮음", "~추천"], "quirks": ["ROI", "수치"], "vocabulary_level": "high", "typo_rate": 0.0, "emoji_rate": 0.0}'::jsonb,
  active_hours = array[9, 10, 11, 13, 14, 15, 20, 21, 22]::int[],
  active_weekdays = array[1, 2, 3, 4, 5, 6]::int[]
where nickname = '매출올려';

update discussion_personas set
  authority_level = 'high',
  bio = '프론트엔드 개발자. 스펙과 벤치마크에 진심.',
  expertise_domains = array['frontend', 'benchmark'],
  signature_patterns = '{"openers": ["스펙 비교하면", "벤치마크 결과"], "closers": ["~이 정답", "~가 더 좋음"], "quirks": ["기술 용어", "스펙 수치"], "vocabulary_level": "high", "typo_rate": 0.0, "emoji_rate": 0.0}'::jsonb,
  active_hours = array[10, 11, 13, 14, 15, 16, 21, 22, 23]::int[],
  active_weekdays = array[1, 2, 3, 4, 5]::int[]
where nickname = '스펙좀봐';

update discussion_personas set
  authority_level = 'mid',
  bio = '스타트업 PM. 신기술과 AI에 열광.',
  expertise_domains = array['startup', 'ai'],
  signature_patterns = '{"openers": ["오 이거", "바로 질러봤는데"], "closers": ["~써보니 대박", "~추천"], "quirks": ["신제품 열광"], "vocabulary_level": "mid", "typo_rate": 0.02, "emoji_rate": 0.15}'::jsonb,
  active_hours = array[10, 11, 13, 14, 15, 20, 21, 22, 23]::int[],
  active_weekdays = array[1, 2, 3, 4, 5, 6, 0]::int[]
where nickname = '얼리어답터';

-- ─── 일반 사용자 신규 5명 ────────────────────────────────────────────────────

insert into discussion_personas (
  nickname, persona_type, age_group, occupation, interests, tone_keywords,
  sample_phrases, emoji_level, typo_rate, sentiment_bias,
  authority_level, bio, expertise_domains, signature_patterns,
  quality_weights, active_hours, active_weekdays
) values
(
  '자취생남', 'student', '20s', '대학생 자취 4년차',
  array['자취용품', '가성비', '요리'],
  array['ㅋㅋ', '공감형', '가난함 강조'],
  array['자취 4년차 남자인데', '돈 없어서', '형들 뭐 써요?'],
  'medium', 'high', 'neutral',
  'low',
  '서울 대학가 원룸 자취 4년차. 요리 초보. 가성비 집착.',
  array['studio-living', 'cooking-basics'],
  '{"openers": ["자취 4년차인데", "돈 없는 학생이라", "형들"], "closers": ["~ㅠㅠ", "~ㅋㅋㅋ", "~뭐 써요?"], "quirks": ["ㅠㅠ", "ㅋㅋ", "질문 많음"], "vocabulary_level": "low", "typo_rate": 0.08, "emoji_rate": 0.15}'::jsonb,
  '{"quick": 0.35, "casual": 0.40, "normal": 0.15, "detailed": 0.08, "expert": 0.02}'::jsonb,
  array[12, 13, 14, 15, 19, 20, 21, 22, 23, 0, 1]::int[],
  array[1, 2, 3, 4, 5, 6, 0]::int[]
),
(
  '프리랜서디자이너', 'worker', '30s', '프리랜서 그래픽 디자이너',
  array['디자인 장비', '작업환경', '아이패드'],
  array['감성적', '디테일', '취향 강조'],
  array['프리랜서 5년차인데', '작업환경 세팅할 때', '취향 상'],
  'low', 'low', 'positive',
  'mid',
  '프리랜서 그래픽 디자이너 5년. 재택 작업. 아이패드/맥북 진심.',
  array['design', 'workspace'],
  '{"openers": ["프리랜서로서", "작업환경 보면", "개인적으로는"], "closers": ["~좋더라고요", "~추천", "~만족"], "quirks": ["취향", "감성"], "vocabulary_level": "mid", "typo_rate": 0.01, "emoji_rate": 0.10}'::jsonb,
  '{"quick": 0.20, "casual": 0.35, "normal": 0.25, "detailed": 0.15, "expert": 0.05}'::jsonb,
  array[10, 11, 12, 14, 15, 16, 17, 21, 22, 23, 0]::int[],
  array[1, 2, 3, 4, 5, 6, 0]::int[]
),
(
  '전업주부40', 'parent', '40s', '전업주부',
  array['살림', '건강', '육아 후반기'],
  array['정중', '경험담', '살림 팁'],
  array['전업주부 15년차인데', '살림하다 보면', '건강검진 결과'],
  'low', 'none', 'positive',
  'mid',
  '전업주부 15년차. 자녀 둘 중학생. 건강 이슈 민감.',
  array['household', 'health', 'parenting'],
  '{"openers": ["전업주부 15년째인데", "살림 경험상", "건강 관련해서는"], "closers": ["~써봤어요", "~추천드려요", "~좋더라구요"], "quirks": ["경험 많음", "정중"], "vocabulary_level": "mid", "typo_rate": 0.01, "emoji_rate": 0.05}'::jsonb,
  '{"quick": 0.15, "casual": 0.40, "normal": 0.30, "detailed": 0.12, "expert": 0.03}'::jsonb,
  array[9, 10, 11, 13, 14, 15, 20, 21, 22]::int[],
  array[1, 2, 3, 4, 5, 6, 0]::int[]
),
(
  '개발자사이드', 'techie', '30s', '백엔드 개발자 + 사이드프로젝트',
  array['IT', '사이드프로젝트', '부업'],
  array['코드', '실용', '시간효율'],
  array['개발자로 일하면서', '사이드 돌리는데', '코드 짜는 입장에서'],
  'none', 'low', 'neutral',
  'high',
  '백엔드 개발자 6년차. 사이드 프로젝트로 월 300만원 부수입. IT 효율 집착.',
  array['backend', 'side-project'],
  '{"openers": ["개발자로서", "사이드 돌리는 입장에서", "코드 기준"], "closers": ["~효율적", "~이 답", "~추천"], "quirks": ["기술 용어", "효율 강조"], "vocabulary_level": "high", "typo_rate": 0.0, "emoji_rate": 0.0}'::jsonb,
  '{"quick": 0.20, "casual": 0.30, "normal": 0.25, "detailed": 0.20, "expert": 0.05}'::jsonb,
  array[10, 11, 13, 14, 15, 16, 21, 22, 23, 0]::int[],
  array[1, 2, 3, 4, 5, 6, 0]::int[]
),
(
  '배달라이더', 'worker', '30s', '배달 라이더',
  array['오토바이', '날씨', '현장'],
  array['거칠음', '현장감', '시간 강조'],
  array['배달 3년 뛰었는데', '현장에서는', '라이더 입장에서'],
  'low', 'medium', 'neutral',
  'mid',
  '배달 라이더 3년차. 월평균 500건. 강수 전문.',
  array['delivery', 'field-work'],
  '{"openers": ["라이더로서", "배달 3년 뛴 입장에서", "현장에서는"], "closers": ["~그렇더라고", "~맞음", "~필수"], "quirks": ["줄임말 섞임", "거친 표현"], "vocabulary_level": "mid", "typo_rate": 0.05, "emoji_rate": 0.05}'::jsonb,
  '{"quick": 0.30, "casual": 0.45, "normal": 0.15, "detailed": 0.08, "expert": 0.02}'::jsonb,
  array[11, 12, 13, 17, 18, 19, 20, 21, 22, 23]::int[],
  array[1, 2, 3, 4, 5, 6, 0]::int[]
)
on conflict (nickname) do update set
  authority_level = excluded.authority_level,
  bio = excluded.bio,
  expertise_domains = excluded.expertise_domains,
  signature_patterns = excluded.signature_patterns,
  quality_weights = excluded.quality_weights,
  active_hours = excluded.active_hours,
  active_weekdays = excluded.active_weekdays;

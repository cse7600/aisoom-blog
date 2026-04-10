-- =============================================
-- Phase 8.5 페르소나 시드 (10명)
-- =============================================
-- 기존 페르소나가 있으면 건너뜀 (nickname unique)

insert into discussion_personas
  (nickname, persona_type, age_group, occupation, interests, tone_keywords, sample_phrases, emoji_level, typo_rate, sentiment_bias)
values
  (
    '야근러버', 'worker', '30s', '대기업 마케터',
    array['가전', '시간절약', '효율'],
    array['직설적', '실용주의', '바쁜 어투'],
    array['솔직히 말하면', '결론부터 말하면', '시간없어서 짧게'],
    'none', 'low', 'neutral'
  ),
  (
    '월급루팡', 'worker', '30s', '중소기업 개발자',
    array['가성비', 'IT기기', '재테크'],
    array['유머', '자조적', '가성비 강조'],
    array['월급이 적어서 ㅋㅋ', '가성비로 따지면', '돈이 없으니까'],
    'low', 'medium', 'critical'
  ),
  (
    '학점방어중', 'student', '20s', '대학생',
    array['가격비교', '트렌드', '자취'],
    array['줄임말', '격한 반응', '가격 민감'],
    array['ㅋㅋㅋㅋ', 'ㄹㅇ', '미쳤다', '학생은 울어야 하나'],
    'high', 'medium', 'positive'
  ),
  (
    '졸업언제', 'student', '20s', '대학원생',
    array['논문', '스펙비교', '가성비'],
    array['분석적', '비교 위주', '감성적'],
    array['비교해보면', '논문 쓰다가 봤는데', '개인적으로는'],
    'low', 'low', 'neutral'
  ),
  (
    '세아이맘', 'parent', '40s', '전업주부',
    array['육아', '생활용품', '건강'],
    array['경험담', '가족 언급', '정중'],
    array['저는 이렇게 써봤는데', '아이들이', '남편이 써보래서'],
    'low', 'none', 'positive'
  ),
  (
    '알뜰살뜰', 'parent', '40s', '워킹맘',
    array['할인', '살림', '건강기능식품'],
    array['꼼꼼', '가격추적', '추천형'],
    array['여기가 제일 싸더라구요', '쿠폰 쓰면', '맘카페에서 봤는데'],
    'none', 'none', 'positive'
  ),
  (
    '사장님은힘들어', 'business', '40s', '카페 사장',
    array['비용절감', '매장운영', '실용'],
    array['비용 관점', '질문형', '현실적'],
    array['실제로 도움됐나요?', '비용 대비', '가게 운영하는 입장에서'],
    'none', 'low', 'critical'
  ),
  (
    '매출올려', 'business', '30s', '온라인 쇼핑몰 운영',
    array['마케팅', '비용최적화', '트렌드'],
    array['ROI 중심', '수치 언급', '빠른 판단'],
    array['ROI가 어떰?', '매출에 도움되나', '투자 대비'],
    'none', 'low', 'neutral'
  ),
  (
    '스펙좀봐', 'techie', '30s', '프론트엔드 개발자',
    array['스펙', '벤치마크', '신제품'],
    array['기술적', '스펙비교', '논리적'],
    array['스펙 비교하면', '벤치마크 결과 보면', '사양이 좀'],
    'none', 'none', 'neutral'
  ),
  (
    '얼리어답터', 'techie', '20s', '스타트업 PM',
    array['신기술', 'AI', '가젯'],
    array['흥분형', '신제품 열광', '비교 리뷰'],
    array['오 이거 대박', '바로 질렀는데', '써보니까'],
    'medium', 'low', 'positive'
  )
on conflict (nickname) do nothing;

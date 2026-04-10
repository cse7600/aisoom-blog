#!/usr/bin/env node
/**
 * Claude Code 직접 각본 삽입 스크립트
 * AI API 없이 사전 작성된 각본을 Supabase에 직접 INSERT
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// .env.local 로드
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.+)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── 페르소나 ID 맵 ───────────────────────────────────────────────────────
const P = {
  // normal / expert
  보안시공기사: "354ea28d-3bb1-4240-b55f-7b0744eac270",
  세무사실장10년: "5c6b5548-90d5-414a-a427-9c3292dd28c9",
  편의점사장7년차: "92f3419b-e24c-4896-9d08-95f313d59ea2",
  법무사사무원: "1bf31fde-98df-42da-9173-4afc512bbe2c",
  쇼핑몰대표: "409a1a97-6fe4-4fc5-a661-62568f32d34d",
  신축상가임대인: "b74a841b-4795-4a44-afd6-16b032025311",
  한식당사장10년: "132c9903-6577-4b34-8423-655c9703c157",
  아파트관리소장: "65ce4968-92f9-43f7-ba49-a32d2f6b1348",
  // normal / mid-low
  자영업카페운영: "1a2e2196-4ff2-49c2-98c5-b92428e85e5c",
  초보창업마케터: "f6255c6f-862b-409d-96d7-da3c29b1ad68",
  예비창업자J: "3db154b1-0e52-453d-8497-748214fd0e05",
  카페사장3년차: "6b35b180-4f36-42a1-8546-54c028dec79f",
  사장님은힘들어: "80adb89c-6f25-402b-9814-49707a1054f9",
  소규모베이커리창업: "ca7b4afd-1c58-41dc-9f1c-f3687bb51446",
  분식집창업준비중: "2f6e1e5b-1ac9-4854-873e-ecc8a87dac9f",
  // chatty
  퇴근빔예약남: "27812041-f4f8-4d8f-9de9-1723f770eb48",
  애엄마수다: "a1e9f7cb-a567-42b1-847a-e5804b40a5e6",
  야근시러: "3cbf6cc4-a800-43d4-9f5a-109b16645336",
  점심뭐먹지녀: "27c51da4-0f0d-46b6-9d7c-3c2362cee4f5",
  지하철러: "01121bb6-79a7-476b-95b3-114ca1a13a9f",
  할일미루기왕: "74ee2cb1-7b2d-4ad8-8475-e7e6e0f236af",
  한강치맥러: "f765e56c-08bf-4064-8cc6-639c6d638b21",
  날씨민감러: "2540c5a7-edd4-420c-b8cb-5c93ebaee1d6",
  강쥐집사누나: "a0d1bae5-3866-4a23-be22-5e239ba2901d",
  // lurker
  읽고감: "c4f3cadb-751f-4ec9-a356-318d6e552dc2",
  댓글은가끔: "1271e93a-cdbe-4652-ae13-dd0c99a9d414",
  유령회원: "5b1a6cf3-7903-40e5-bab5-75386b1e9ab7",
  눈팅전문가: "0730d170-5a61-4f49-802c-c481bfa59304",
  짧게한마디: "25a5efb8-29e4-4a24-9b6d-bf57740d7bf1",
  반응없는그사람: "10b70328-5fe5-489b-9521-82528851106e",
  스쳐지나간바람: "d8daa810-e783-4442-a91b-39c2667aff10",
  // lol_reactor
  ㅋㅋ봇: "29407233-671b-498c-9b4c-4492c54a312c",
  ㅋㅋㅁㅌ: "2e0d9f55-df2c-432a-bf40-18ad04ab3258",
  아진짜못참: "75ea0aa0-0016-432d-8438-5c61f60caaa0",
  공감중독자: "ced526e7-0a89-4ff6-8fcf-6e848aee2188",
  진짜ㅋㅋ: "322f9552-43c7-48c3-8d18-4bb8f4b13576",
  웃기면살아남: "0da7c084-c02a-4259-a3c0-d1fc61a412f9",
  이거ㅋㅋ저장: "e9d206cf-d758-4519-a03c-7059a9e626b5",
};

function ts(base, addHours) {
  const d = new Date(base);
  d.setHours(d.getHours() + addHours);
  return d.toISOString();
}

// 기준 날짜: 3일 전 (자연스러운 최근 포스트)
const BASE = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

// ─── 각본 데이터 ──────────────────────────────────────────────────────────
const SCRIPTS = [
  // ════════════════════════════════════════════════════════
  // 1. 법인설립 비용 — 셀프 vs 대행
  // ════════════════════════════════════════════════════════
  {
    slug: "corporation-setup-cost-self-vs-agent-comparison",
    batch: "manual_claude_corp_setup_cost",
    template: "experience_share",
    discussions: [
      {
        persona: "법무사사무원",
        content: "저희 사무실 기준으로 대행 수수료가 평균 40~60만원 선이에요. 셀프로 하면 등록면허세나 과태료 같은 실비만 나가니까 비용 자체는 절약되는데... 서류 한 번 잘못 내면 반려되고 다시 해야 해서 시간 비용이 장난 아니거든요. 정관 오류로 두 번 반려된 케이스도 꽤 봤어요.",
        sentiment: "neutral", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "예비창업자J",
        content: "저 지금 셀프로 준비 중인데 진짜 모르는 게 너무 많아요ㅠ 정관 작성하다 포기할 뻔... 주식 총수 설정이 이렇게 복잡한 건지 몰랐고요. 그냥 대행 맡길까요? 비용이 얼마나 드는지도 감이 안 잡혀서요.",
        sentiment: "neutral", is_question: true, tier: "casual",
        replies: [
          {
            persona: "법무사사무원",
            content: "발행 주식 총수는 일단 1만주로 두고 액면가 500원 또는 100원으로 설정하는 게 무난해요. 나중에 증자할 여지를 남겨두는 게 좋거든요. 처음에 헷갈리는 게 당연하니까 궁금한 거 있으면 물어보세요.",
            sentiment: "positive", reply_type: "supplement", tier: "normal"
          }
        ]
      },
      {
        persona: "애엄마수다",
        content: "아 이거 읽다가 생각났는데 저희 남편도 법인 만들려고 몇 달을 고민하다 결국 세무사한테 다 맡겼어요 ㅋㅋ 그 세무사가 나중에 기장도 받아서 계속 거래 중이에요 처음부터 전문가한테 맡기는 게 맞는 것 같기도 하고... 근데 오늘 장 보다 왔는데 왜 이런 글 읽고 있지 나는 ㅋㅋ",
        sentiment: "positive", is_question: false, tier: "casual",
        replies: [
          {
            persona: "ㅋㅋ봇",
            content: "세무사가 처음부터 기다리고 있었던 거 ㅋㅋㅋ 장 보다가 법인설립 글 읽는 거 공감됩니다 ㅋㅋ",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "쇼핑몰대표",
        content: "저는 첫 번째 법인은 셀프로 했고 두 번째는 대행 맡겼는데, 확실히 두 번째가 훨씬 편했습니다. 비용 차이보다 제 시간 가치를 계산하면 대행이 훨씬 이득이에요. 사업 초기에 행정 처리에 쏟는 시간이 매출에 집중할 시간이거든요. 50만원 아끼려고 일주일 날리는 건 비효율이라 봐요.",
        sentiment: "positive", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "읽고감",
        content: "정보 감사합니다",
        sentiment: "positive", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 2. CCTV 렌탈 vs 구매
  // ════════════════════════════════════════════════════════
  {
    slug: "cctv-rental-vs-purchase-cost-comparison",
    batch: "manual_claude_cctv_rental_purchase",
    template: "expert_qa",
    discussions: [
      {
        persona: "보안시공기사",
        content: "실제 현장 기준으로 말씀드리면, 렌탈은 AS가 포함된다는 게 핵심이에요. 구매 후 3년 지나서 카메라 하나 고장나면 부품 구하기도 어렵고 기사 부르는 비용이 따로 드는데, 이게 렌탈 비용이랑 비슷하거나 넘는 경우도 있어요. 카메라 4채널 기준으로 AS 비용만 연 10~15만원은 잡아야 현실적이에요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "편의점사장7년차",
            content: "맞아요. 저도 구매했다가 2년 만에 레코더 고장나서 AS 불렀는데 출장비만 4만원이더라고요. 그다음엔 그냥 렌탈로 바꿨어요.",
            sentiment: "neutral", reply_type: "agree", tier: "casual"
          }
        ]
      },
      {
        persona: "편의점사장7년차",
        content: "편의점 5년 운영하면서 렌탈 → 구매 → 다시 렌탈 왔다갔다 해봤습니다. 결론은 매장 규모가 크고 카메라 수 많으면 구매가 낫고, 소규모면 렌탈이 맞는 것 같아요. AS 한 번 부르는데 5~10만원 넘게 드니까요. 저는 카메라 6대 이상이면 구매, 그 미만이면 렌탈 추천해요.",
        sentiment: "neutral", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "할일미루기왕",
        content: "아 이거 진짜 고민이다 저도 작은 가게 열려고 하는데... 근데 오늘 날씨가 너무 좋아서 일단 커피나 마시고 결정해야겠다 ㅋㅋ 진지하게 렌탈 업체 몇 군데 비교해봐야 할 것 같긴 한데 전화하기 귀찮음",
        sentiment: "positive", is_question: false, tier: "casual",
        replies: [
          {
            persona: "아진짜못참",
            content: "커피 마시고 결정 ㅋㅋㅋ 공감 100%임 ㅋㅋ 저도 이러다 가게 못 열 것 같음",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "자영업카페운영",
        content: "렌탈 계약할 때 중도해지 위약금 조항 꼭 확인하세요. 저는 그거 놓쳐서 폐업하면서 위약금 꽤 냈어요. 계약서 세부 조항이 업체마다 천차만별이에요. 남은 계약 개월 수 × 월 렌탈료 100% 위약금인 데도 있고, 50%인 데도 있으니까요.",
        sentiment: "negative", is_question: false, tier: "normal",
        replies: []
      },
      {
        persona: "눈팅전문가",
        content: "다음 달에 인테리어 하면서 CCTV 알아봐야 하는데 참고할게요",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 3. 한화비전 키퍼 vs 세콤
  // ════════════════════════════════════════════════════════
  {
    slug: "hanwha-keeper-vs-secom-cctv",
    batch: "manual_claude_hanwha_secom",
    template: "deep_debate",
    discussions: [
      {
        persona: "보안시공기사",
        content: "시공 입장에서 보면 한화비전 키퍼가 화질이나 야간 성능은 확실히 좋아요. 근데 세콤은 실제 출동 서비스가 붙어있다는 게 다른 차원의 가치거든요. CCTV 단순 녹화 vs 보안 서비스로 나눠서 보셔야 해요. 빈 매장에 뭔가 일어났을 때 누군가가 출동해준다는 게 심리적 안정감이 있거든요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: []
      },
      {
        persona: "신축상가임대인",
        content: "임대인 입장에서 임차인들한테 물어보면 사실 브랜드보다 모니터링 앱 편의성 얘기를 더 많이 해요. 한화 키퍼 앱이 세콤보다 훨씬 쓰기 편하다는 후기가 많더라고요. 앱으로 실시간 확인하는 게 일상화됐으니까 이게 체감 만족도에서 꽤 중요해요.",
        sentiment: "positive", is_question: false, tier: "normal",
        replies: []
      },
      {
        persona: "퇴근빔예약남",
        content: "저는 세콤 영업 전화 너무 많이 받아서 그냥 한화로 갔는데 ㅋㅋ 전화 영업 싫어서 결정한 거긴 한데 막상 써보니까 나쁘지 않음. 앱도 괜찮고 화질도 생각보다 좋아요",
        sentiment: "positive", is_question: false, tier: "casual",
        replies: [
          {
            persona: "ㅋㅋㅁㅌ",
            content: "전화 영업 싫어서 경쟁사 선택하는 거 ㅋㅋ 저도 이렇게 결정하고 싶음",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "사장님은힘들어",
        content: "150만원 차이면 사실 3년 약정에 월 4만원 차이인데 그게 큰 돈인 소상공인 입장에서는 무시 못 하죠. 기능이 비슷하면 싼 게 낫다고 봐요. 세콤 브랜드값 내는 게 맞냐는 의문은 계속 있어요.",
        sentiment: "critical", is_question: false, tier: "normal",
        replies: []
      },
      {
        persona: "짧게한마디",
        content: "키퍼 써봤는데 나쁘지 않았음",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 4. 세콤·캡스·에스원 CCTV 가격 비교
  // ════════════════════════════════════════════════════════
  {
    slug: "secom-caps-hanwha-keeper-cctv-cost-comparison",
    batch: "manual_claude_secom_caps_esone",
    template: "experience_share",
    discussions: [
      {
        persona: "보안시공기사",
        content: "이 세 군데 다 견적 따봤는데, 같은 스펙 기준으로 캡스가 제일 비싼 경우가 많았어요. 다만 캡스는 기업 납품 경험이 많아서 대형 사업장에는 어울리고, 소상공인이면 한화 키퍼나 자체 구매가 가성비 측면에서 훨씬 나아요. 세콤은 중간 정도인데 출동 서비스 포함 여부에 따라 가격 차이가 꽤 커요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: []
      },
      {
        persona: "한식당사장10년",
        content: "저 세콤 쓰다가 캡스로 바꿨다가 지금 키퍼로 왔어요. 솔직히 말씀드리면 이 세 곳 다 어떤 영업사원 만나느냐에 따라 가격이 천차만별이에요. 무조건 3군데 이상 견적 받으세요. 같은 세콤이어도 담당자마다 20%씩 차이 나는 경우 봤어요.",
        sentiment: "neutral", is_question: false, tier: "detailed",
        replies: [
          {
            persona: "카페사장3년차",
            content: "맞아요 저도 세 군데 견적 받았는데 가격 차이가 장난 아니었어요. 같은 캡스인데 두 명한테 받은 견적이 15만원 차이 났거든요.",
            sentiment: "neutral", reply_type: "agree", tier: "casual"
          }
        ]
      },
      {
        persona: "지하철러",
        content: "지하철에서 이거 읽었는데 저도 곧 매장 오픈 예정이라 타이밍 딱이다... 근데 이 세 군데 전부 전화하기가 귀찮아서 어디 한 군데만 할 것 같음 ㅋㅋ 귀찮음이 인생을 지배하고 있어",
        sentiment: "neutral", is_question: false, tier: "casual",
        replies: [
          {
            persona: "공감중독자",
            content: "어디 한 군데만 전화하기 ㅋㅋ 저도 이렇게 삶... 공감합니다ㅠ",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "초보창업마케터",
        content: "가격 비교도 중요한데 계약 기간이랑 위약금 조항이 업체마다 다르다는 게 함정이에요. 짧게 쓸 거면 그냥 구매가 낫고, 오래 할 거면 렌탈이 나은 경우도 있고... 저는 처음에 이걸 몰라서 계약서 대충 읽다가 2년 묶인 적 있어요.",
        sentiment: "neutral", is_question: false, tier: "normal",
        replies: []
      },
      {
        persona: "유령회원",
        content: ".",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 5. 소상공인 CCTV 정부지원금 2026
  // ════════════════════════════════════════════════════════
  {
    slug: "small-business-cctv-subsidy-2026",
    batch: "manual_claude_cctv_subsidy",
    template: "quick_opinion",
    discussions: [
      {
        persona: "편의점사장7년차",
        content: "지원금 받으려면 진짜 서류 준비가 까다로운데, 특히 '설치업체 간판 사진'이나 '사업자 현황 확인서' 이런 거 요구할 때 당황했던 기억이 있어요. 사전에 필요 서류 리스트 뽑아두고 하나씩 준비하는 게 중요해요. 서류 하나 빠지면 보완 기간에 쫓기거든요.",
        sentiment: "neutral", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "카페사장3년차",
        content: "작년에 신청했는데 예산 소진이 생각보다 빨랐어요. 3월에 지원금 공고 나오자마자 바로 신청했는데도 4월에 마감됐거든요. 올해 생각 있으면 지금부터 서류 준비하는 게 맞아요. 선착순이라 늦으면 무조건 다음 해예요.",
        sentiment: "neutral", is_question: false, tier: "normal",
        replies: []
      },
      {
        persona: "날씨민감러",
        content: "오늘 비 오는데 이거 읽으면서 아 나도 가게 좀 열어볼까 싶기도 하고... 지원금 이런 거 보면 정부가 소상공인 챙겨주려는 건 맞는 것 같긴 한데 막상 신청하면 복잡하다는 말도 많고. 비 오는 날엔 왜 이런 생각이 더 드는지",
        sentiment: "neutral", is_question: false, tier: "casual",
        replies: [
          {
            persona: "진짜ㅋㅋ",
            content: "비 오는 날 창업 생각하는 거 ㅋㅋ 저도 이런 생각 해봤음 ㅋ 비 오면 왜 인생 계획하게 되는지",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "분식집창업준비중",
        content: "준비하는 입장에서 이런 지원금 정보 너무 도움이 됐어요! 소상공인 진흥원 앱에서 신청 가능한 거 맞죠? 아니면 직접 방문해야 하나요?",
        sentiment: "positive", is_question: true, tier: "casual",
        replies: [
          {
            persona: "카페사장3년차",
            content: "소진공 홈페이지에서 온라인으로 신청 가능한데, 처음엔 공인인증서 설치 같은 게 번거로울 수 있어요. 근처 소상공인 지원센터 가면 도와줘요.",
            sentiment: "positive", reply_type: "supplement", tier: "normal"
          }
        ]
      },
      {
        persona: "댓글은가끔",
        content: "신청해봐야겠네요",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 6. 2026 법인세율 vs 소득세
  // ════════════════════════════════════════════════════════
  {
    slug: "2026-corporate-tax-rate-vs-income-tax-should-i-establish-corporation",
    batch: "manual_claude_corp_tax_2026",
    template: "expert_qa",
    discussions: [
      {
        persona: "세무사실장10년",
        content: "법인세율 올랐어도 여전히 법인이 유리한 구간이 있어요. 핵심은 대표 급여 설계인데, 법인에서 대표 급여로 빼고, 법인세 납부하고, 나머지를 유보 이익으로 남기는 구조를 짜면 개인사업자 소득세보다 세금 총액이 적은 경우가 많거든요. 단 세무사랑 반드시 상담은 필수입니다.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "예비창업자J",
            content: "그러면 법인 대표가 급여를 많이 책정하면 그만큼 법인세가 줄어드는 구조인 건가요? 이게 절세가 되는 이유가 궁금해요.",
            sentiment: "neutral", reply_type: "question", tier: "casual"
          }
        ]
      },
      {
        persona: "쇼핑몰대표",
        content: "작년에 법인 전환했는데 솔직히 세금보다 복지 측면이 더 좋더라고요. 4대보험을 법인 비용으로 처리하면서 퇴직금도 적립되고... 세금만 보지 말고 전체 그림으로 봐야 해요. 직원 채용할 때도 법인이 훨씬 신뢰도 있고요.",
        sentiment: "positive", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "야근시러",
        content: "아 진짜 이런 거 읽을 때마다 나도 빨리 사업해야겠다는 생각 드는데 막상 현실은 야근 중 ㅋㅋㅋ 오늘도 12시 넘겼는데 법인세율 공부 중... 언젠간 해야지",
        sentiment: "neutral", is_question: false, tier: "casual",
        replies: [
          {
            persona: "웃기면살아남",
            content: "야근 중에 창업 생각하는 거 너무 현실적임 ㅋㅋㅋ 저도 야근하다 소상공인 대출 알아봤던 기억이",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "예비창업자J",
        content: "법인세율이 올랐다는 뉴스 보고 법인 설립 포기할 뻔했는데 이 글 보고 다시 생각해보게 됐어요. 연 매출 기준이 어느 정도 되면 법인이 유리한가요? 개인사업자 순이익 8천만원 정도면 법인 전환 고려해볼 만한가요?",
        sentiment: "positive", is_question: true, tier: "normal",
        replies: []
      },
      {
        persona: "반응없는그사람",
        content: "좋은 정보",
        sentiment: "positive", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 7. 학원 CCTV 설치 가이드
  // ════════════════════════════════════════════════════════
  {
    slug: "academy-cctv-installation-guide",
    batch: "manual_claude_academy_cctv",
    template: "experience_share",
    discussions: [
      {
        persona: "보안시공기사",
        content: "학원 CCTV는 일반 상가랑 다르게 아동보호법 관련 법적 요건이 있어요. 교실 내부 촬영 시 학부모 동의서 징구, 녹화 데이터 보관 기간 등이 법으로 정해져 있는데 이걸 모르고 그냥 달았다가 민원 들어오는 경우가 꽤 있어요. 특히 화장실 앞 복도는 설치 각도 신경 써야 해요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: []
      },
      {
        persona: "아파트관리소장",
        content: "저희 건물에 학원이 여러 개 들어와 있는데, 관리 입장에서 보면 복도 CCTV 위치를 학원 측에서 임의로 바꾸는 경우가 종종 있어요. 기존 공용 CCTV와 겹치면 문제 생기니까 설치 전에 건물 관리소에 미리 위치 조율 요청하는 게 좋습니다.",
        sentiment: "neutral", is_question: false, tier: "normal",
        replies: [
          {
            persona: "보안시공기사",
            content: "맞아요. 관리소 협의가 중요한데 실제로 공용 구역에 학원용 카메라 달다가 관리소랑 마찰 생기는 경우 봤어요. 설치 전 협의 필수예요.",
            sentiment: "neutral", reply_type: "agree", tier: "casual"
          }
        ]
      },
      {
        persona: "강쥐집사누나",
        content: "오 저 학원 원장님한테 이 글 공유해야겠다 ㅋㅋ 우리 강아지 데리고 아이 데리러 갔다가 CCTV 앞에서 엄청 쑥스러웠는데 그래도 있는 게 안전하긴 하죠. 요즘 애들 학원 보낼 때 CCTV 유무 확인하는 부모님들 많더라고요.",
        sentiment: "positive", is_question: false, tier: "casual",
        replies: [
          {
            persona: "이거ㅋㅋ저장",
            content: "강아지 데리고 학원 데리러 가는 거 ㅋㅋㅋ CCTV에 강아지 찍히는 장면 상상됨 ㅋㅋ",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "소규모베이커리창업",
        content: "학원은 아니지만 베이커리 운영하면서 CCTV 설치했는데 이 글 보니까 학부모 동의 같은 절차가 필요하다는 거 처음 알았어요. 사업장 종류마다 다른 규정이 있군요. 저도 법적 요건 다시 확인해봐야겠어요.",
        sentiment: "positive", is_question: false, tier: "normal",
        replies: []
      },
      {
        persona: "스쳐지나간바람",
        content: "참고할게요",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  }
];

// ─── INSERT 로직 ──────────────────────────────────────────────────────────

async function insertPost(script, baseTime) {
  const { slug, batch, template, discussions } = script;
  let commentOffset = 0;
  let totalComments = 0;
  let totalReplies = 0;

  for (const disc of discussions) {
    const personaId = P[disc.persona];
    if (!personaId) {
      console.warn(`  ⚠ 페르소나 없음: ${disc.persona}`);
      continue;
    }

    const createdAt = ts(baseTime, commentOffset);
    commentOffset += Math.random() * 2 + 0.5; // 0.5~2.5시간 간격

    const { data: inserted, error } = await supabase
      .from("post_discussions")
      .insert({
        post_slug: slug,
        persona_id: personaId,
        content: disc.content,
        sentiment: disc.sentiment,
        is_question: disc.is_question,
        upvotes: Math.floor(Math.random() * 8),
        published: true,
        generation_batch: batch,
        thread_template: template,
        generation_phase: "bootstrap",
        quality_tier: disc.tier,
        char_count: disc.content.length,
        created_at: createdAt,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  ✗ 댓글 삽입 실패 [${disc.persona}]: ${error.message}`);
      continue;
    }

    totalComments++;
    const discussionId = inserted.id;

    // 대댓글
    for (const rep of disc.replies ?? []) {
      const repPersonaId = P[rep.persona];
      if (!repPersonaId) continue;

      const repTime = ts(createdAt, Math.random() * 1.5 + 0.2);
      const { error: repErr } = await supabase
        .from("discussion_replies")
        .insert({
          discussion_id: discussionId,
          persona_id: repPersonaId,
          content: rep.content,
          sentiment: rep.sentiment,
          upvotes: Math.floor(Math.random() * 5),
          published: true,
          generation_batch: batch,
          quality_tier: rep.tier,
          char_count: rep.content.length,
          response_model: "immediate",
          created_at: repTime,
        });

      if (repErr) {
        console.error(`    ✗ 대댓글 실패 [${rep.persona}]: ${repErr.message}`);
        continue;
      }
      totalReplies++;
    }
  }

  return { totalComments, totalReplies };
}

async function main() {
  console.log("Phase 8.8 각본 직접 삽입 시작\n");

  // 포스트별 시작 시간: 3일 전부터 하루씩 분산
  const baseDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  let grandTotal = { comments: 0, replies: 0 };

  for (let i = 0; i < SCRIPTS.length; i++) {
    const script = SCRIPTS[i];
    // 포스트마다 12시간 간격으로 분산
    const postBase = new Date(baseDate.getTime() + i * 12 * 60 * 60 * 1000).toISOString();
    process.stdout.write(`[${i + 1}/${SCRIPTS.length}] ${script.slug}\n`);

    const { totalComments, totalReplies } = await insertPost(script, postBase);
    grandTotal.comments += totalComments;
    grandTotal.replies += totalReplies;
    console.log(`  → 댓글 ${totalComments}개, 대댓글 ${totalReplies}개\n`);
  }

  console.log(`\n완료: 총 댓글 ${grandTotal.comments}개, 대댓글 ${grandTotal.replies}개`);
}

main().catch(console.error);

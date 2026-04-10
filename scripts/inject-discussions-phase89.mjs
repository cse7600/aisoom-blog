#!/usr/bin/env node
/**
 * Phase 8.9 커뮤니티 각본 자동화
 * CCTV 7개 + 법인설립 10개 = 17개 포스트 토론 주입
 * 기존 inject-discussions.mjs와 동일한 로직 사용, SCRIPTS만 신규 17개
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.+)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const P = {
  보안시공기사: "354ea28d-3bb1-4240-b55f-7b0744eac270",
  세무사실장10년: "5c6b5548-90d5-414a-a427-9c3292dd28c9",
  편의점사장7년차: "92f3419b-e24c-4896-9d08-95f313d59ea2",
  법무사사무원: "1bf31fde-98df-42da-9173-4afc512bbe2c",
  쇼핑몰대표: "409a1a97-6fe4-4fc5-a661-62568f32d34d",
  신축상가임대인: "b74a841b-4795-4a44-afd6-16b032025311",
  한식당사장10년: "132c9903-6577-4b34-8423-655c9703c157",
  아파트관리소장: "65ce4968-92f9-43f7-ba49-a32d2f6b1348",
  자영업카페운영: "1a2e2196-4ff2-49c2-98c5-b92428e85e5c",
  초보창업마케터: "f6255c6f-862b-409d-96d7-da3c29b1ad68",
  예비창업자J: "3db154b1-0e52-453d-8497-748214fd0e05",
  카페사장3년차: "6b35b180-4f36-42a1-8546-54c028dec79f",
  사장님은힘들어: "80adb89c-6f25-402b-9814-49707a1054f9",
  소규모베이커리창업: "ca7b4afd-1c58-41dc-9f1c-f3687bb51446",
  분식집창업준비중: "2f6e1e5b-1ac9-4854-873e-ecc8a87dac9f",
  퇴근빔예약남: "27812041-f4f8-4d8f-9de9-1723f770eb48",
  애엄마수다: "a1e9f7cb-a567-42b1-847a-e5804b40a5e6",
  야근시러: "3cbf6cc4-a800-43d4-9f5a-109b16645336",
  점심뭐먹지녀: "27c51da4-0f0d-46b6-9d7c-3c2362cee4f5",
  지하철러: "01121bb6-79a7-476b-95b3-114ca1a13a9f",
  할일미루기왕: "74ee2cb1-7b2d-4ad8-8475-e7e6e0f236af",
  한강치맥러: "f765e56c-08bf-4064-8cc6-639c6d638b21",
  날씨민감러: "2540c5a7-edd4-420c-b8cb-5c93ebaee1d6",
  강쥐집사누나: "a0d1bae5-3866-4a23-be22-5e239ba2901d",
  읽고감: "c4f3cadb-751f-4ec9-a356-318d6e552dc2",
  댓글은가끔: "1271e93a-cdbe-4652-ae13-dd0c99a9d414",
  유령회원: "5b1a6cf3-7903-40e5-bab5-75386b1e9ab7",
  눈팅전문가: "0730d170-5a61-4f49-802c-c481bfa59304",
  짧게한마디: "25a5efb8-29e4-4a24-9b6d-bf57740d7bf1",
  반응없는그사람: "10b70328-5fe5-489b-9521-82528851106e",
  스쳐지나간바람: "d8daa810-e783-4442-a91b-39c2667aff10",
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

// ─── Phase 8.9 신규 17개 각본 ─────────────────────────────────────────────
const SCRIPTS = [
  // ════════════════════════════════════════════════════════
  // CCTV 1. 캡스 vs 키퍼 계약 비교
  // ════════════════════════════════════════════════════════
  {
    slug: "caps-vs-keeper-contract-comparison",
    batch: "manual_claude_phase89_caps_keeper",
    template: "deep_debate",
    discussions: [
      {
        persona: "보안시공기사",
        content: "캡스 계약 기간 3년에 묶여있다가 해지하려면 위약금 구조가 진짜 애매해요. 약정 잔여 기간 × 월 요금 50~70% 계산이 일반적인데 이게 계약서마다 달라서 캡스고객센터에 직접 문의해야 정확한 금액 나와요. 한화 키퍼는 최근에 계약 유연화해서 중도해지 구간이 조금 더 저렴한 편이고요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "편의점사장7년차",
            content: "저도 캡스 2년 쓰다가 키퍼로 갈아탔는데 위약금 80만원 나왔어요. 미리 계산 안 해보면 진짜 당황함.",
            sentiment: "negative", reply_type: "agree", tier: "casual"
          }
        ]
      },
      {
        persona: "한식당사장10년",
        content: "저는 캡스 10년째 쓰고 있는데 안정성은 확실해요. 다만 월 요금이 키퍼보다 조금 비싼 건 맞아요. 출동 서비스 포함하면 8~9만원대고 키퍼는 7만원대. 근데 출동 실제로 필요한 상황 오면 브랜드 파워가 중요하더라고요. 음식점은 야간 빈 매장이라 이게 진짜 체감돼요.",
        sentiment: "positive", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "쇼핑몰대표",
        content: "계약 기간 단축 가능한지 문의해봤는데 캡스는 3년 기본, 1년짜리 상품도 있는데 월 요금 1.5배 붙더라고요. 이거 영업사원이 먼저 알려주지 않아서 계약 직전에 확인해야 합니다. 저처럼 사무실 자주 옮기는 업종은 1년짜리가 오히려 이득이에요.",
        sentiment: "neutral", is_question: false, tier: "detailed",
        replies: [
          {
            persona: "예비창업자J",
            content: "오 1년 상품도 있었군요. 저는 3년만 있다고 들어서 고민 중이었는데 알아봐야겠네요.",
            sentiment: "positive", reply_type: "answer", tier: "casual"
          }
        ]
      },
      {
        persona: "퇴근빔예약남",
        content: "이거 퇴근하고 와서 읽는데 머리 아프다 ㅋㅋ 가게 하나 열려고 알아보는 중인데 계약서 조항이 왜 이렇게 많은지... 맥주 한 캔 하면서 다시 읽어야겠다",
        sentiment: "neutral", is_question: false, tier: "casual",
        replies: [
          {
            persona: "한강치맥러",
            content: "치킨에 맥주 추천 ㅋㅋ 계약서는 술 깨고 읽어야 함",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "눈팅전문가",
        content: "캡스 해지 관련 정보 찾고 있었는데 감사",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      },
      {
        persona: "읽고감",
        content: "스크랩했어요",
        sentiment: "positive", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // CCTV 2. 무인매장 CCTV 증거 기준
  // ════════════════════════════════════════════════════════
  {
    slug: "unmanned-store-cctv-evidence-standard",
    batch: "manual_claude_phase89_unmanned_evidence",
    template: "expert_qa",
    discussions: [
      {
        persona: "보안시공기사",
        content: "무인매장 CCTV가 경찰 수사 증거로 채택되려면 최소 200만 화소 이상, 프레임 15fps 이상이 현실적인 기준이에요. 100만 화소짜리는 얼굴 식별이 어려워서 증거 가치가 떨어지는 경우 많아요. 그리고 보관 기간은 최소 30일, 무인매장은 60일 권장합니다. 캡스화재보험 사고 접수할 때도 30일 이전 영상 요구하는 경우 있거든요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "편의점사장7년차",
            content: "작년에 도난 사건 터졌을 때 경찰이 30일치 영상 요구해서 다행히 있었어요. 없었으면 사건 종결 못 됐을 겁니다.",
            sentiment: "neutral", reply_type: "supplement", tier: "casual"
          }
        ]
      },
      {
        persona: "편의점사장7년차",
        content: "무인매장 7년째인데 진짜 CCTV가 생명줄이에요. 이중 녹화 시스템으로 로컬 NVR + 클라우드 동시 백업해두는 거 추천합니다. NVR 통째로 훔쳐가는 케이스도 있거든요. 클라우드는 월 2~3만원 추가되는데 사고 한 번이면 본전 뽑아요.",
        sentiment: "positive", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "자영업카페운영",
        content: "저희는 카페지만 야간에 무인으로 돌리는 시간대가 있어서 찾아봤는데, 화소만 높다고 다가 아니라 조명도 중요하다네요. 형광등 아래랑 자연광 아래 화질이 완전 다르다고 해요. 추가 조명 설치하고 나서 얼굴 인식률 확 올라갔어요.",
        sentiment: "positive", is_question: false, tier: "normal",
        replies: [
          {
            persona: "보안시공기사",
            content: "맞아요. 조도 300lux 이상 확보가 중요해요. 특히 계산대 쪽은 500lux 권장. 저조도 카메라도 조명 없으면 한계 있어요.",
            sentiment: "neutral", reply_type: "supplement", tier: "normal"
          }
        ]
      },
      {
        persona: "소규모베이커리창업",
        content: "베이커리도 무인으로 아침 시간대 운영하는 곳 많은데 CCTV 증거 기준 이거 진짜 중요한 정보네요. 사고 나면 보험사랑 경찰 양쪽 다 영상 달라고 할 텐데... 저장 용량 넉넉하게 잡아야겠어요.",
        sentiment: "positive", is_question: false, tier: "normal",
        replies: []
      },
      {
        persona: "할일미루기왕",
        content: "무인매장 차리려다가 계속 미루고 있는데 이거 읽으니까 더 미루고 싶어짐 ㅋㅋ 신경쓸 게 너무 많네",
        sentiment: "negative", is_question: false, tier: "casual",
        replies: [
          {
            persona: "공감중독자",
            content: "무인매장은 무인이 아니라 풀타임 CCTV 모니터링이라는 말 ㅋㅋ 진짜 공감",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "반응없는그사람",
        content: "참고",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // CCTV 3. 매장 CCTV 화소 선택 (200/400/800만)
  // ════════════════════════════════════════════════════════
  {
    slug: "store-cctv-resolution-selection",
    batch: "manual_claude_phase89_resolution",
    template: "expert_qa",
    discussions: [
      {
        persona: "보안시공기사",
        content: "실측 기준으로 말씀드리면 200만 화소는 3~4m 거리에서 얼굴 식별 가능, 400만은 6~7m, 800만은 10m 이상 가능해요. 매장 크기가 10평 이하면 200만으로 충분하고, 20~30평이면 400만, 그 이상이거나 주차장 감시하면 800만 가야 해요. 화소 올라갈수록 저장 용량 급증하는 건 감안하셔야 합니다.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "카페사장3년차",
            content: "저 카페 15평인데 400만 달았어요. 200만이었으면 구석 테이블 얼굴 안 보였을 것 같아요.",
            sentiment: "positive", reply_type: "agree", tier: "casual"
          }
        ]
      },
      {
        persona: "편의점사장7년차",
        content: "저장 용량 계산 공유해드릴게요. 4채널 기준 200만 화소는 2TB HDD면 30일 녹화 가능, 400만은 4TB, 800만은 8TB 필요해요. 용량 부족하면 오래된 거 자동 삭제되는데 사고 영상 필요한 시점에 날아가면 진짜 황당함. 저장 용량은 여유 있게 잡아야 해요.",
        sentiment: "neutral", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "분식집창업준비중",
        content: "분식집 작게 시작하려는데 200만 하면 되는 건가요? 주방 내부랑 홀 두 대만 생각 중이에요. 예산 200만원 안쪽으로 잡았는데 가능할까요?",
        sentiment: "neutral", is_question: true, tier: "casual",
        replies: [
          {
            persona: "보안시공기사",
            content: "2채널 200만 화소는 재료비 + 시공비 합쳐서 60~90만원이면 충분해요. 예산 여유 있네요. 나머지 예산으로 UPS(정전 대비 배터리)랑 클라우드 백업 추가 추천합니다.",
            sentiment: "positive", reply_type: "answer", tier: "detailed"
          }
        ]
      },
      {
        persona: "점심뭐먹지녀",
        content: "매장 CCTV 화소 얘기 보니까 이거 진짜 복잡하네요 ㅋㅋ 저는 직원이라 상관없지만 사장님들 고생 많으세요... 오늘 점심 뭐 먹지",
        sentiment: "neutral", is_question: false, tier: "casual",
        replies: [
          {
            persona: "ㅋㅋ봇",
            content: "점심 뭐 먹지 ㅋㅋ 진짜 공감",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "스쳐지나간바람",
        content: "잘 봤습니다",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // CCTV 4. 편의점 CCTV 필수 스펙
  // ════════════════════════════════════════════════════════
  {
    slug: "convenience-store-cctv-essential-spec",
    batch: "manual_claude_phase89_convenience_spec",
    template: "experience_share",
    discussions: [
      {
        persona: "편의점사장7년차",
        content: "편의점 CCTV는 최소 6채널입니다. 계산대 2대(카운터 뒤쪽 + 정면), 매장 전경 1대, 냉장 코너 1대, 출입구 1대, 주류/담배 진열대 1대. 이거 미만으로 달면 사각지대 생겨서 도난 사건 때 책임 소재 불명확해져요. 본사 점검 나와도 이 기준 확인합니다.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "보안시공기사",
            content: "맞아요. 24시간 무인 운영 시 최소 6채널 + 야간 저조도 지원 필수예요. 편의점은 사각지대 하나가 도난 사고로 직결되니까요.",
            sentiment: "neutral", reply_type: "agree", tier: "normal"
          }
        ]
      },
      {
        persona: "보안시공기사",
        content: "편의점은 진짜 특수 스펙입니다. 24시간 돌려야 해서 NVR 발열 관리 중요하고요. 여름철에 NVR 고장나는 케이스 자주 봐요. 하우징 통풍 잘 되는 위치에 두고, 가능하면 전용 쿨링 팬 설치하는 것도 방법이에요. 그리고 정전 시 최소 30분 백업 가능한 UPS 필수.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: []
      },
      {
        persona: "신축상가임대인",
        content: "상가 주인 입장에서 보면 편의점 세입자 받을 때 CCTV 스펙 미리 협의하는 게 좋아요. 나중에 사건 터지면 건물주한테도 연락 오거든요. 공용 복도 CCTV랑 편의점 내부 CCTV 각도 조율 미리 해야 하고요. 저는 계약서에 CCTV 스펙 명시 조항 넣었어요.",
        sentiment: "positive", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "초보창업마케터",
        content: "편의점 창업 알아보는 중인데 이 글이 딱 필요했어요. 본사에서 설치비 지원해준다고 했는데 스펙은 6채널 기본이라고 하더라고요. 그 이상으로 업그레이드하려면 자비 부담이라고 해서 고민 중. 업그레이드 할 가치가 있을까요?",
        sentiment: "neutral", is_question: true, tier: "normal",
        replies: [
          {
            persona: "편의점사장7년차",
            content: "본사 기본은 사실상 최저 스펙이라 업그레이드 추천해요. 저는 8채널로 업그레이드했고 월 1만원 추가됐는데 그 이상 값어치 합니다.",
            sentiment: "positive", reply_type: "answer", tier: "casual"
          }
        ]
      },
      {
        persona: "야근시러",
        content: "편의점 알바할 때 CCTV 카메라 많은 곳 일하면 마음이 더 편했음 ㅋㅋ 사장님들 CCTV 많이 달아주세요 알바생 보호차원",
        sentiment: "positive", is_question: false, tier: "casual",
        replies: []
      },
      {
        persona: "유령회원",
        content: "ㅇㅇ",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // CCTV 5. CCTV 설치 기준 2026 (개인정보보호법)
  // ════════════════════════════════════════════════════════
  {
    slug: "cctv-legal-standards-2026",
    batch: "manual_claude_phase89_legal_2026",
    template: "expert_qa",
    discussions: [
      {
        persona: "보안시공기사",
        content: "2026년 개정된 개인정보보호법 기준으로 매장 내 CCTV 설치 시 안내판 의무가 강화됐어요. 설치 목적, 촬영 범위, 관리 책임자 연락처, 보관 기간 이렇게 4가지 필수 명시. 안내판 안 붙이면 과태료 최대 500만원까지 나올 수 있습니다. 그리고 화장실/탈의실 촬영은 예외 없이 금지.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "법무사사무원",
            content: "맞아요. 2026년부터 과태료 구간이 강화돼서 소상공인도 예외 없이 적용돼요. 안내판 양식은 개인정보보호위원회 홈페이지에 표준 서식 있어요.",
            sentiment: "neutral", reply_type: "supplement", tier: "normal"
          }
        ]
      },
      {
        persona: "한식당사장10년",
        content: "저희 가게 CCTV 안내판 5년 전에 붙여놓고 그대로 뒀는데 이번에 법 개정 됐다니 새로 확인해야겠네요. 보관 기간 30일이라고 쓰여있는데 실제로는 90일 저장되고 있어서 불일치 문제 있을 수 있겠어요. 일치시켜야겠습니다.",
        sentiment: "neutral", is_question: false, tier: "detailed",
        replies: [
          {
            persona: "보안시공기사",
            content: "그게 오히려 문제예요. 안내판에 명시한 기간과 실제 보관 기간이 달라도 과태료 대상입니다. NVR 설정에서 30일로 맞추시거나 안내판을 90일로 수정하셔야 해요.",
            sentiment: "negative", reply_type: "disagree", tier: "detailed"
          }
        ]
      },
      {
        persona: "카페사장3년차",
        content: "카페 내부 CCTV 설치 기준이 일반 매장이랑 좀 다르더라고요. 테이블 고객 얼굴이 정면으로 찍히는 위치는 피해야 하고, 주로 주방이나 카운터 중심으로 설치해야 한대요. 손님 컴플레인 몇 번 받고 나서 위치 재조정했어요.",
        sentiment: "neutral", is_question: false, tier: "normal",
        replies: []
      },
      {
        persona: "자영업카페운영",
        content: "2026 CCTV 법 개정 내용 찾고 있었는데 핵심 5가지 정리된 거 너무 감사합니다. 특히 안내판 의무 사항 꼼꼼히 체크해야겠어요. 사실 5년 전에 달고 한 번도 안 건드렸거든요.",
        sentiment: "positive", is_question: false, tier: "normal",
        replies: []
      },
      {
        persona: "날씨민감러",
        content: "오늘 비 오는데 CCTV 얘기 읽고 있는 나... 카페 가서 읽으면 더 집중 잘 될 것 같음",
        sentiment: "neutral", is_question: false, tier: "casual",
        replies: [
          {
            persona: "이거ㅋㅋ저장",
            content: "비 오는 날 CCTV 법률 공부 ㅋㅋ 로맨틱",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "짧게한마디",
        content: "필요한 정보",
        sentiment: "positive", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // CCTV 6. CCTV 해킹 실제 사례
  // ════════════════════════════════════════════════════════
  {
    slug: "cctv-hacking-chinese-vs-korean",
    batch: "manual_claude_phase89_hacking",
    template: "deep_debate",
    discussions: [
      {
        persona: "보안시공기사",
        content: "IP카메라 해킹 사례 대부분이 초기 비밀번호 그대로 두거나 admin/1234 같은 단순 비번 쓰는 경우예요. 중국산 저가 카메라는 펌웨어 백도어 이슈가 몇 년째 나왔고 해외 해킹 커뮤니티에서 공유되기까지 합니다. 국산이라고 100% 안전한 건 아니지만 주기적 펌웨어 업데이트가 된다는 점이 큰 차이에요.",
        sentiment: "negative", is_question: false, tier: "expert",
        replies: [
          {
            persona: "편의점사장7년차",
            content: "저도 3년 전에 중국산 IP캠 샀다가 해킹 의심되는 트래픽 나와서 다 바꿨어요. 국산으로 바꾼 뒤로는 문제 없었습니다.",
            sentiment: "negative", reply_type: "agree", tier: "casual"
          }
        ]
      },
      {
        persona: "보안시공기사",
        content: "해킹 방지 기본 체크리스트 공유해드릴게요. 1) 관리자 비밀번호 즉시 변경(특수문자 포함 12자 이상), 2) UPnP 기능 off, 3) 원격 접속 VPN 통해서만, 4) 펌웨어 최신 유지, 5) 공유기 포트포워딩 제한. 이 5가지만 지켜도 해킹 리스크 90% 이상 줄어요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: []
      },
      {
        persona: "쇼핑몰대표",
        content: "온라인 쇼핑몰 운영하면서 사무실 CCTV 해킹당한 적 있어요. 제품 기획 회의 내용이 경쟁사로 새어 나간 게 의심돼서 확인했더니 IP캠 관리자 화면이 외부에서 접근 가능한 상태였어요. 비밀번호는 설치 기사님이 설정해준 거 그대로 썼고요. 그 뒤로 전체 시스템 교체했습니다.",
        sentiment: "negative", is_question: false, tier: "detailed",
        replies: [
          {
            persona: "초보창업마케터",
            content: "경쟁사한테 정보 새는 거 진짜 무서운데... CCTV가 그 통로가 될 줄은 몰랐어요. 저도 점검해봐야겠어요.",
            sentiment: "negative", reply_type: "agree", tier: "casual"
          }
        ]
      },
      {
        persona: "예비창업자J",
        content: "CCTV 영상보안 취약점이라는 말 처음 들어봤어요. 저가 중국산 안 쓰면 그나마 안전한 건가요? 아니면 국산도 설정 안 하면 똑같이 위험한 건가요?",
        sentiment: "neutral", is_question: true, tier: "casual",
        replies: [
          {
            persona: "보안시공기사",
            content: "국산도 설정 안 하면 위험해요. 브랜드보다 설정 중요합니다. 특히 초기 관리자 비밀번호 변경은 무조건 하셔야 합니다.",
            sentiment: "neutral", reply_type: "answer", tier: "detailed"
          }
        ]
      },
      {
        persona: "지하철러",
        content: "지하철에서 이거 읽는데 소름 돋음 ㅋㅋ 내 원룸에 있는 홈캠도 해킹 가능하다는 건가... 집 가서 비번 바꿔야겠다",
        sentiment: "negative", is_question: false, tier: "casual",
        replies: [
          {
            persona: "아진짜못참",
            content: "홈캠 해킹 무서워서 나 아예 안 씀 ㅋㅋ",
            sentiment: "negative", reply_type: "supplement", tier: "quick"
          }
        ]
      },
      {
        persona: "읽고감",
        content: "비밀번호 바꾸러 갑니다",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // CCTV 7. 카페 CCTV 설치비용 월 1만원대
  // ════════════════════════════════════════════════════════
  {
    slug: "cafe-cctv-installation-cost-under-10000",
    batch: "manual_claude_phase89_cafe_cost",
    template: "experience_share",
    discussions: [
      {
        persona: "카페사장3년차",
        content: "10평 카페 3년 운영하면서 CCTV 렌탈 월 1만원대로 쓰고 있어요. SK소상공인 상품 대비해서 찾아봤는데 중소 업체 렌탈 상품이 오히려 더 저렴했어요. 4채널 400만 화소 + 2TB NVR + 설치비 무료. 대기업 브랜드는 안전성 때문에 쓴다지만 가성비는 중소 업체가 나아요.",
        sentiment: "positive", is_question: false, tier: "detailed",
        replies: [
          {
            persona: "자영업카페운영",
            content: "저도 카페 CCTV 비용 알아보는 중이었는데 반가운 정보네요. 중소 업체 어디 쓰시는지 DM으로 여쭤봐도 될까요?",
            sentiment: "positive", reply_type: "agree", tier: "casual"
          }
        ]
      },
      {
        persona: "보안시공기사",
        content: "10평 카페 기준 CCTV 최소 구성은 4채널이에요. 월 1만원대 렌탈 가능한 건 사실인데 계약 기간이 보통 36~60개월로 길어요. 중도 해지 시 위약금 꼭 확인하시고, AS 응답 시간도 업체마다 달라요. 대기업은 당일 출동, 중소는 1~3일 걸리는 경우도 있거든요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: []
      },
      {
        persona: "소규모베이커리창업",
        content: "베이커리 오픈 준비 중인데 10평대라서 이 글 진짜 도움 돼요. 월 1만원대면 부담 없이 갈 수 있을 것 같아요. 근데 카페랑 베이커리는 동선이 좀 달라서 카메라 위치가 다를 수도 있을까요?",
        sentiment: "positive", is_question: true, tier: "normal",
        replies: [
          {
            persona: "보안시공기사",
            content: "베이커리는 진열대 쪽 카메라가 핵심이에요. 빵 절도 사건이 의외로 자주 있어서요. 카페랑 달리 계산대와 진열대 거리가 먼 경우가 많아서 진열대 전용 카메라 1대 추가 권장합니다.",
            sentiment: "neutral", reply_type: "answer", tier: "detailed"
          }
        ]
      },
      {
        persona: "분식집창업준비중",
        content: "10평 카페 월 1만원대면 분식집도 비슷하겠죠? 저도 딱 그 규모로 준비 중인데 CCTV 비용 예산 잡기가 애매했거든요. 한 달에 1만원이면 아메리카노 2잔값이네요.",
        sentiment: "positive", is_question: false, tier: "casual",
        replies: [
          {
            persona: "ㅋㅋㅁㅌ",
            content: "아메리카노 2잔값으로 CCTV 달 수 있는 세상 ㅋㅋ",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "퇴근빔예약남",
        content: "월 1만원이면 할만하네 ㅋㅋ 퇴근하고 와서 카페 차리기 프로젝트 또 발동하고 싶어짐",
        sentiment: "positive", is_question: false, tier: "casual",
        replies: []
      },
      {
        persona: "댓글은가끔",
        content: "저장",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 법인 1. 부가가치세 법인 vs 개인
  // ════════════════════════════════════════════════════════
  {
    slug: "vat-corporation-vs-sole-2026",
    batch: "manual_claude_phase89_vat_2026",
    template: "expert_qa",
    discussions: [
      {
        persona: "세무사실장10년",
        content: "2026년부터 간이과세 기준이 연매출 1억400만원으로 상향됐는데, 이게 개인사업자한테 유리한 포인트예요. 법인은 무조건 일반과세라서 매출 작을 때는 개인이 부가세 부담 적어요. 다만 매출 3억 넘어가면 법인 전환 후 매입세액 공제 폭이 커지는 구조라 법인이 오히려 유리해집니다. 전자세금계산서 발행 기준도 법인은 2천만원부터라 주의하셔야 해요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "쇼핑몰대표",
            content: "저도 연매출 2억 넘어가면서 법인 전환했는데 매입세액 공제 받는 게 진짜 컸어요. 개인일 때는 광고비 세금계산서 받아도 공제 못 받았거든요.",
            sentiment: "positive", reply_type: "agree", tier: "casual"
          }
        ]
      },
      {
        persona: "법무사사무원",
        content: "부가세 측면에서 법인 전환 고민하시면 일단 매출 구조 파악이 먼저예요. B2C만 하면 부가세 그대로 고객 부담이라 법인 이점 적고, B2B 비율 높으면 매입세액 공제 받을 수 있어서 법인 유리. 이거 세무사랑 시뮬레이션 한 번 해보시는 게 좋아요. 전환 비용이 200~300만원 드니까요.",
        sentiment: "neutral", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "예비창업자J",
        content: "저 지금 간이과세자인데 부가세 신고가 1년에 한 번이라 편하긴 해요. 근데 법인 가면 분기별로 해야 한다는 거죠? 거래처가 세금계산서 달라고 하는데 간이과세라서 못 주겠다고 했더니 거래 끊기는 경우도 있어서 고민이에요.",
        sentiment: "neutral", is_question: true, tier: "casual",
        replies: [
          {
            persona: "세무사실장10년",
            content: "법인은 1,4,7,10월 총 4번 신고예요. 세금계산서 발행이 거래처 유지에 중요하면 법인 전환 긍정적으로 보셔야 해요. 거래처 놓치는 게 더 큰 손실이거든요.",
            sentiment: "positive", reply_type: "answer", tier: "detailed"
          }
        ]
      },
      {
        persona: "초보창업마케터",
        content: "2026 부가세 법인 vs 개인 비교 자료 찾고 있었는데 딱이네요. 저는 아직 연매출 5천만원도 안 돼서 당분간은 개인이 맞을 것 같아요. 법인 전환은 매출 성장 이후로 미뤄야겠어요.",
        sentiment: "positive", is_question: false, tier: "normal",
        replies: []
      },
      {
        persona: "사장님은힘들어",
        content: "부가세 생각만 해도 머리 아픈데 ㅠㅠ 법인까지 가면 더 복잡해지는 거 아닌가요. 세무사 쓰는 게 답인 것 같아요.",
        sentiment: "negative", is_question: false, tier: "casual",
        replies: [
          {
            persona: "공감중독자",
            content: "부가세 머리아픔 공감 1000% 세무사님이 답입니다 ㅋㅋ",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "눈팅전문가",
        content: "공부하고 갑니다",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 법인 2. 주식회사 vs 유한회사 2026
  // ════════════════════════════════════════════════════════
  {
    slug: "stock-vs-limited-company-comparison",
    batch: "manual_claude_phase89_stock_limited",
    template: "deep_debate",
    discussions: [
      {
        persona: "법무사사무원",
        content: "실무적으로 말씀드리면 주식회사 99%, 유한회사 1% 정도 비율이에요. 유한회사가 설립/운영 간소하다는 장점이 있는데 외부 투자 유치가 거의 불가능해서 대부분 주식회사로 갑니다. 다만 가족 기업이나 완전 폐쇄형으로 운영할 거면 유한회사가 편해요. 이사 회의록 작성 의무 없고, 정관 변경도 간단하거든요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "세무사실장10년",
            content: "맞아요. 유한회사는 감사 의무 면제 혜택도 있어서 회계 부담이 적어요. 단, 외부 투자 받으려고 주식회사로 전환하려면 절차가 복잡해요.",
            sentiment: "neutral", reply_type: "supplement", tier: "detailed"
          }
        ]
      },
      {
        persona: "쇼핑몰대표",
        content: "저는 처음에 유한회사로 했다가 투자 받으려다 결국 주식회사로 전환했어요. 그 과정에서 비용 400만원 넘게 나왔고 시간도 3개월 걸렸어요. 나중에 후회했는데 처음부터 주식회사로 갈 걸 그랬죠. 투자 안 받을 확신이 있으면 유한회사, 조금이라도 가능성 있으면 무조건 주식회사예요.",
        sentiment: "negative", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "세무사실장10년",
        content: "세제 측면에서는 주식회사와 유한회사 거의 동일해요. 법인세율, 배당소득세 다 같습니다. 차이는 운영 유연성에 있어요. 주식회사 주소이전 시 본점 이전 등기 필수인데 유한회사도 동일하게 적용되고요. SPC(특수목적법인) 설립도 주식회사 형태가 일반적이에요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: []
      },
      {
        persona: "예비창업자J",
        content: "저는 1인 법인이라서 유한회사가 맞을까 했는데, 나중에 투자 가능성 생각하면 주식회사가 나은 것 같네요. 1인 주식회사도 가능한 거죠? 발기인 1명이 가능한지 확인 필요해서요.",
        sentiment: "neutral", is_question: true, tier: "casual",
        replies: [
          {
            persona: "법무사사무원",
            content: "네 1인 주식회사 가능합니다. 발기인 1명, 이사 1명, 감사는 자본금 10억 미만이면 생략 가능해요. 1인 법인이면 주식회사 + 1인 이사 구조로 가시면 돼요.",
            sentiment: "positive", reply_type: "answer", tier: "detailed"
          }
        ]
      },
      {
        persona: "할일미루기왕",
        content: "주식회사 vs 유한회사 진짜 고민하다가 결국 법인설립 몇 달째 미루고 있음 ㅋㅋ 나 같은 사람 많을 듯",
        sentiment: "neutral", is_question: false, tier: "casual",
        replies: [
          {
            persona: "아진짜못참",
            content: "저도 6개월째 미루는 중 ㅋㅋㅋ 완벽주의자 특",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "유령회원",
        content: "ㅎㅇ",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 법인 3. 개인사업자 법인전환 시뮬레이션
  // ════════════════════════════════════════════════════════
  {
    slug: "sole-to-corp-conversion-simulation",
    batch: "manual_claude_phase89_conversion_sim",
    template: "expert_qa",
    discussions: [
      {
        persona: "세무사실장10년",
        content: "연매출별 법인 전환 타이밍 시뮬레이션 공유드리면, 3억 미만은 개인이 낫고, 3~5억 구간은 케이스별로 달라요. 5억 이상이면 대부분 법인 전환이 유리합니다. 이유는 소득세 최고 세율 42%인데 법인세는 20억 미만 구간에서 9~19% 구간이라서요. 유상증자로 자본 확충도 법인이 훨씬 쉽고요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "쇼핑몰대표",
            content: "저는 연매출 4억 구간에서 전환했는데 첫 해는 살짝 손해였어요. 전환 비용 + 초기 비용 때문에요. 두 번째 해부터 절세 효과 확 체감했습니다.",
            sentiment: "positive", reply_type: "supplement", tier: "detailed"
          }
        ]
      },
      {
        persona: "세무사실장10년",
        content: "법인 전환 시 주의할 점 하나 더 추가하면, 개인사업자 시절 자산을 법인에 넘길 때 양도세 발생 가능성 있어요. 특히 부동산이나 기계장비 넘길 때 감정평가 필수이고, 이거 제대로 안 하면 세무조사 대상 됩니다. 전환 전에 자산 평가부터 하셔야 해요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: []
      },
      {
        persona: "법무사사무원",
        content: "법인 전환 시 포괄양도양수 방식이 가장 많이 쓰여요. 이 방식은 개인사업장을 통째로 법인에 넘기는 거라 사업자 단절 없이 진행됩니다. 서류는 포괄양도양수 계약서 + 자산부채 명세서 필수이고, 법무사 통해 진행하면 수수료 100~150만원 정도예요.",
        sentiment: "neutral", is_question: false, tier: "detailed",
        replies: [
          {
            persona: "예비창업자J",
            content: "포괄양도양수라는 용어 처음 들어봤어요. 개인사업장 넘길 때 필수인 건가요?",
            sentiment: "neutral", reply_type: "answer", tier: "casual"
          }
        ]
      },
      {
        persona: "사장님은힘들어",
        content: "연매출 3억 애매한 구간이라 전환 고민 중이었는데 이 글 덕에 결론 났어요. 당분간은 개인으로 버티다가 5억 근처 가면 그때 전환 준비할게요. 감사합니다.",
        sentiment: "positive", is_question: false, tier: "normal",
        replies: []
      },
      {
        persona: "퇴근빔예약남",
        content: "법인전환 시뮬레이션 보면 볼수록 어지러운데 ㅋㅋ 일단 매출부터 올리고 생각해야 할 것 같음",
        sentiment: "neutral", is_question: false, tier: "casual",
        replies: [
          {
            persona: "웃기면살아남",
            content: "매출부터 올리고 ㅋㅋ 정답입니다",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "짧게한마디",
        content: "굿정보",
        sentiment: "positive", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 법인 4. 온라인 쇼핑몰 법인전환 시기
  // ════════════════════════════════════════════════════════
  {
    slug: "online-shop-corporation-setup-timing",
    batch: "manual_claude_phase89_onlineshop_timing",
    template: "experience_share",
    discussions: [
      {
        persona: "쇼핑몰대표",
        content: "온라인 쇼핑몰 법인 전환 타이밍 결론부터 말씀드리면, 월매출 2천만원 넘어가면 바로 고민 시작하세요. 통신판매업 기준으로 부가세 분기 신고가 법인은 의무인데, 매출 3천 이하면 개인이 편합니다. 근데 3천 넘어가면 세무사 비용 + 전환 비용 감안해도 법인이 유리해요. 저는 월 4천 찍었을 때 전환했습니다.",
        sentiment: "positive", is_question: false, tier: "detailed",
        replies: [
          {
            persona: "세무사실장10년",
            content: "딱 맞는 기준이에요. 월매출 3천 이상이면 법인 전환 검토 시작, 5천 이상이면 전환 거의 필수라고 봅니다.",
            sentiment: "positive", reply_type: "agree", tier: "normal"
          }
        ]
      },
      {
        persona: "세무사실장10년",
        content: "온라인 쇼핑몰은 매입세액 공제 받을 항목이 많아서 법인이 유리한 측면이 커요. 광고비(페이스북, 네이버, 구글), 플랫폼 수수료, 배송비, 포장재 다 공제 대상이거든요. 개인사업자도 공제 받지만 법인이 구조적으로 유리하고, 특히 간이과세자는 매입세액 공제 전혀 안 돼서 불리합니다.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: []
      },
      {
        persona: "초보창업마케터",
        content: "온라인 쇼핑몰 오픈 준비 중인데 법인으로 시작할지 개인으로 시작할지 진짜 고민이었어요. 일단 개인으로 시작해서 매출 추이 보고 전환하는 게 나을까요? 아니면 처음부터 법인이 나을까요?",
        sentiment: "neutral", is_question: true, tier: "normal",
        replies: [
          {
            persona: "쇼핑몰대표",
            content: "처음엔 개인으로 시작하세요. 법인으로 시작하면 매출 없는데 기장료 + 세무사 비용만 나가서 손해예요. 월 2천 이상 꾸준히 찍히면 그때 전환하는 게 맞아요.",
            sentiment: "positive", reply_type: "answer", tier: "detailed"
          }
        ]
      },
      {
        persona: "법무사사무원",
        content: "통신판매업 등록 관련해서도 법인과 개인 차이 있어요. 법인은 법인등기부등본으로 통신판매 신고 가능한데 개인은 주민등록 주소지가 사업장과 일치해야 해서 재택 쇼핑몰 운영 시 법인이 유연성 높아요.",
        sentiment: "neutral", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "애엄마수다",
        content: "저 온라인 쇼핑몰 부업으로 하고 있는데 아직 월 100만원도 안 나와요 ㅠㅠ 법인은 꿈도 못 꾸는 수준이지만 이런 글 읽으면서 목표 세우게 되네요. 애 재우고 또 포스트 올리러 가야겠다",
        sentiment: "positive", is_question: false, tier: "casual",
        replies: [
          {
            persona: "공감중독자",
            content: "애 재우고 일하는 엄마 대표님 존경합니다 ㅠㅠ 응원해요",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "읽고감",
        content: "북마크",
        sentiment: "positive", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 법인 5. 1인 법인설립 4일 완성
  // ════════════════════════════════════════════════════════
  {
    slug: "one-person-corporation-4days-guide",
    batch: "manual_claude_phase89_1person_4days",
    template: "experience_share",
    discussions: [
      {
        persona: "법무사사무원",
        content: "1인 법인 4일 완성 가능해요. 1일차 상호 확인 + 잔액증명서, 2일차 정관 작성 + 공증, 3일차 법인 등기 신청, 4일차 등기부등본 수령. 다만 이건 서류 완벽 준비 됐을 때 기준이고, 처음 하시는 분들은 정관 반려로 하루 이틀 더 걸리는 경우 많아요. 온라인 등기 이용하면 공증 과정 일부 생략 가능합니다.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "예비창업자J",
            content: "4일이면 생각보다 빠르네요. 저는 한 달 정도 걸릴 줄 알았어요. 정관만 잘 준비하면 되는 거군요.",
            sentiment: "positive", reply_type: "agree", tier: "casual"
          }
        ]
      },
      {
        persona: "쇼핑몰대표",
        content: "저는 1인 법인 셀프로 4일 만에 끝냈어요. 온라인 등기 시스템이 생각보다 잘 돼 있어서 어렵지 않았고요. 다만 정관 템플릿만 제대로 구해야 해요. 인터넷에 돌아다니는 템플릿 쓰면 반려되기 쉽고, 상법 전문 변호사 블로그나 법무부 표준 양식 쓰는 게 안전해요.",
        sentiment: "positive", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "세무사실장10년",
        content: "법인설립 4일 완성 후에 해야 할 게 더 많아요. 법인통장 개설, 사업자등록(세무서), 4대보험 가입, 통신판매 신고(해당 시)... 등기만 끝났다고 끝이 아니라서 실제로는 2주 정도 걸린다고 봐야 해요. 4일은 등기까지만.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "법무사사무원",
            content: "맞아요. 등기 이후 절차가 더 복잡한 경우도 많아요. 특히 법인통장 개설 시 은행에서 실사 오는 경우도 있고요.",
            sentiment: "neutral", reply_type: "supplement", tier: "normal"
          }
        ]
      },
      {
        persona: "초보창업마케터",
        content: "1인 법인 4일 완성 가이드 진짜 원했던 정보예요. 이거 따라하면 저도 할 수 있을 것 같아요. 온라인 등기가 생각보다 간편하다니 믿어지지 않지만 도전해봐야겠어요.",
        sentiment: "positive", is_question: false, tier: "normal",
        replies: []
      },
      {
        persona: "할일미루기왕",
        content: "4일이면 할 수 있겠다 싶다가도 결국 또 미룰 것 같음 ㅋㅋ 일단 북마크",
        sentiment: "neutral", is_question: false, tier: "casual",
        replies: [
          {
            persona: "ㅋㅋ봇",
            content: "북마크만 쌓아두는 폴더 열일 ㅋㅋ",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "반응없는그사람",
        content: "ㄱㅅ",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 법인 6. 프리랜서 1인 법인전환 세금
  // ════════════════════════════════════════════════════════
  {
    slug: "freelancer-one-person-corporation-tax",
    batch: "manual_claude_phase89_freelancer_tax",
    template: "expert_qa",
    discussions: [
      {
        persona: "세무사실장10년",
        content: "프리랜서 법인 전환 실효세율 시뮬레이션 해드리면, 연 1억 버는 프리랜서 기준 개인 원천세 3.3% + 종합소득세 최종 세율 약 24~26%, 법인은 법인세 9% + 대표 급여 원천징수 + 배당세 조합으로 최종 18~22% 수준이에요. 연 1억 구간부터 법인이 확실히 유리해집니다. 다만 기장료 + 세무사 비용 월 20~40만원 감안하셔야 해요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "쇼핑몰대표",
            content: "정확한 계산이네요. 저도 프리랜서에서 법인 전환했을 때 이 구간이었는데 실효세율 차이 진짜 컸어요.",
            sentiment: "positive", reply_type: "agree", tier: "casual"
          }
        ]
      },
      {
        persona: "법무사사무원",
        content: "프리랜서가 법인 전환 시 사업장 주소 고민이 많아요. 집을 사업장으로 쓰면 임대차 계약서 없어서 곤란하고, 공유오피스 이용이 가장 많이 선택되는 방식이에요. 월 10~20만원대 공유오피스면 법인 등록 주소로 충분히 인정됩니다. 다만 가상오피스는 사업자 등록 거부 사례 있으니 주의하세요.",
        sentiment: "neutral", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "세무사실장10년",
        content: "프리랜서에서 법인 전환 후 흔한 실수가 대표 급여를 너무 높게 책정하는 거예요. 급여가 높으면 원천세 + 4대보험료 부담 커지고, 오히려 법인 전환 이점이 사라져요. 월 300~400 정도로 설정하고 나머지는 배당이나 퇴직금으로 가져가는 구조가 유리합니다.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "초보창업마케터",
            content: "대표 급여 최적 구간이 300~400이라는 거 처음 알았어요. 그냥 넉넉하게 500 이상 받으려 했는데 재검토해야겠네요.",
            sentiment: "positive", reply_type: "answer", tier: "casual"
          }
        ]
      },
      {
        persona: "예비창업자J",
        content: "저 프리랜서 디자이너인데 연 8천 정도예요. 이 구간은 아직 개인이 나은 거죠? 법인 전환 미리 준비하려고 보고 있는데 1억 근처 가면 본격적으로 알아봐야겠네요.",
        sentiment: "neutral", is_question: true, tier: "casual",
        replies: [
          {
            persona: "세무사실장10년",
            content: "8천만원 구간은 아직 개인이 유리해요. 9천~1억 근처 오면 시뮬레이션 해보시고 결정하세요. 미리 준비하시는 거 좋습니다.",
            sentiment: "positive", reply_type: "answer", tier: "detailed"
          }
        ]
      },
      {
        persona: "야근시러",
        content: "프리랜서 1억 버는 사람들은 어떻게 그렇게 버나요 ㅠㅠ 회사 다니는 나는 언제 ㅋㅋ",
        sentiment: "negative", is_question: false, tier: "casual",
        replies: [
          {
            persona: "아진짜못참",
            content: "1억 버는 프리랜서 부러움 ㅋㅋ 나도 프리 가고 싶다",
            sentiment: "negative", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "눈팅전문가",
        content: "실효세율 정보 감사합니다",
        sentiment: "positive", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 법인 7. 법인설립 후 첫 달 체크리스트
  // ════════════════════════════════════════════════════════
  {
    slug: "first-month-after-corporation-setup",
    batch: "manual_claude_phase89_first_month",
    template: "experience_share",
    discussions: [
      {
        persona: "법무사사무원",
        content: "법인설립 후 첫 달 8단계 체크리스트 실무 기준으로 정리하면, 1) 법인인감카드 발급(등기소), 2) 사업자등록(관할 세무서, 20일 이내), 3) 법인 통장 개설, 4) 4대보험 가입(대표 포함), 5) 본점 현판 부착, 6) 정관 사본 비치, 7) 주주명부 작성, 8) 회계 프로그램 세팅. 순서 중요합니다. 법인인감카드 없으면 통장 개설 안 되거든요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "세무사실장10년",
            content: "맞아요. 사업자등록 20일 기한 지키는 거 중요해요. 늦으면 가산세 붙습니다. 생각보다 많이 놓치세요.",
            sentiment: "neutral", reply_type: "supplement", tier: "detailed"
          }
        ]
      },
      {
        persona: "쇼핑몰대표",
        content: "법인통장 개설 진짜 복잡했어요. 은행마다 요구 서류가 다른데 대표적으로 법인 인감증명서, 등기부등본, 정관 사본, 대표자 신분증 다 필요하고요. 어떤 은행은 실사도 왔어요. 1인 법인이라 사무실 없이 집 주소로 등록했는데 집에 은행 직원이 방문해서 실사했습니다. 미리 상주 인증 가능한 상태 만들어 놓으세요.",
        sentiment: "negative", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "세무사실장10년",
        content: "법인설립 첫 달 놓치기 쉬운 게 4대보험 가입입니다. 대표 1인이어도 국민연금 + 건강보험 법인 명의로 가입해야 해요. 이걸 빼먹으면 나중에 소급 적용돼서 수백만원 청구되는 경우 있어요. 법인인감카드 받자마자 국민연금공단 + 건강보험공단 처리하세요.",
        sentiment: "negative", is_question: false, tier: "expert",
        replies: [
          {
            persona: "예비창업자J",
            content: "1인 법인인데도 4대보험 가입해야 하는 거군요. 몰랐어요. 감사합니다.",
            sentiment: "positive", reply_type: "answer", tier: "casual"
          }
        ]
      },
      {
        persona: "초보창업마케터",
        content: "법인설립 후 첫 달 체크리스트 딱 필요했어요. 설립까지만 생각했지 그 이후에 할 일이 이렇게 많을 줄 몰랐네요. 8단계 프린트해서 벽에 붙여놔야겠어요.",
        sentiment: "positive", is_question: false, tier: "normal",
        replies: []
      },
      {
        persona: "사장님은힘들어",
        content: "8단계 들으니까 벌써부터 힘들다 ㅠㅠ 근데 하긴 해야겠죠",
        sentiment: "negative", is_question: false, tier: "casual",
        replies: [
          {
            persona: "진짜ㅋㅋ",
            content: "8단계에서 이미 지침 ㅋㅋ 사장님들 존경",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "스쳐지나간바람",
        content: "저장합니다",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 법인 8. 법인 차량 세금 혜택
  // ════════════════════════════════════════════════════════
  {
    slug: "corporation-vehicle-tax-benefits",
    batch: "manual_claude_phase89_vehicle_tax",
    template: "expert_qa",
    discussions: [
      {
        persona: "세무사실장10년",
        content: "법인 차량 세금 혜택 핵심은 업무용 승용차 손금 인정 한도예요. 연 800만원까지 기본 손금 인정되고, 운행일지 작성하면 추가 공제 가능해요. 리스/렌트/구매 중에서 리스가 가장 유연하고 구매는 감가상각으로 처리. 최근 국세청 기준이 강화돼서 운행일지 안 쓰면 세무조사 대상 확률 높아요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "쇼핑몰대표",
            content: "저 법인 차 리스로 쓰는데 운행일지 매일 써요. 귀찮긴 한데 안 쓰면 공제 못 받으니까 어쩔 수 없어요.",
            sentiment: "neutral", reply_type: "agree", tier: "casual"
          }
        ]
      },
      {
        persona: "법무사사무원",
        content: "법인 차량 명의 이전 시 서류 챙길 게 많아요. 법인인감증명서, 등기부등본, 사업자등록증, 대표자 신분증, 자동차 등록증. 그리고 차량 구매 대금이 법인 통장에서 나가야 손금 인정됩니다. 대표 개인 계좌에서 샀다가 법인으로 넘기는 건 세무상 불이익 있어요.",
        sentiment: "neutral", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "세무사실장10년",
        content: "리스 vs 렌트 vs 구매 실무 기준으로 말씀드리면, 리스는 월 비용 전액 손금 인정(한도 내), 렌트도 동일, 구매는 감가상각 5년 + 유류비 + 수리비 손금 인정. 단기 운영은 렌트, 장기 운영 + 초기 현금 부담 줄이려면 리스, 법인 자산으로 유지하려면 구매. 대부분 리스 선호해요.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "초보창업마케터",
            content: "리스가 가장 많이 쓰이는 거군요. 저도 법인 차 알아보는 중인데 리스부터 보겠습니다.",
            sentiment: "positive", reply_type: "answer", tier: "casual"
          }
        ]
      },
      {
        persona: "예비창업자J",
        content: "법인 차량 고급차 타면 국세청에서 눈여겨본다는 말 들었는데 진짜인가요? 어느 가격대부터 문제 되는지 궁금해요.",
        sentiment: "neutral", is_question: true, tier: "casual",
        replies: [
          {
            persona: "세무사실장10년",
            content: "보통 법인 규모 대비 5천만원 이상 차량이면 업무 필요성 입증 자료 요구받을 수 있어요. 매출 대비 합리적 범위 내에서 선택하시는 게 안전합니다.",
            sentiment: "neutral", reply_type: "answer", tier: "detailed"
          }
        ]
      },
      {
        persona: "한강치맥러",
        content: "법인차 타고 한강 가고 싶다 ㅋㅋ 근데 운행일지 써야 한다니 그것도 귀찮아 보임",
        sentiment: "neutral", is_question: false, tier: "casual",
        replies: [
          {
            persona: "이거ㅋㅋ저장",
            content: "한강 가는 거 업무용으로 적으면 되지 ㅋㅋㅋ 농담임",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "댓글은가끔",
        content: "유익해요",
        sentiment: "positive", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 법인 9. 법인설립 서류 12종 체크리스트
  // ════════════════════════════════════════════════════════
  {
    slug: "corporation-setup-document-checklist",
    batch: "manual_claude_phase89_doc_checklist",
    template: "experience_share",
    discussions: [
      {
        persona: "법무사사무원",
        content: "법인설립 서류 12종 리스트 실무 기준으로 정리하면, 1) 정관, 2) 발기인 의사록, 3) 이사회 의사록, 4) 주식 인수증, 5) 잔액증명서, 6) 본점 소재지 증명(임대차계약서 등), 7) 법인인감신고서, 8) 주주명부, 9) 취임승낙서, 10) 이사/감사 인감증명서, 11) 법인 등록세 영수증, 12) 법인 등기 신청서. 이거 중 하나라도 빠지면 반려됩니다.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "예비창업자J",
            content: "12종이나 있는 줄 몰랐어요... 하나씩 준비하면 되는 거죠? 이거 법무사 통하면 다 해주는 건가요?",
            sentiment: "neutral", reply_type: "answer", tier: "casual"
          }
        ]
      },
      {
        persona: "법무사사무원",
        content: "임원변경등기 시에도 서류 양식 있어요. 변경등기는 임원 취임/사임/해임 시 반드시 해야 하는데 2주 이내 신청 기한 있고, 지나면 과태료 50만원부터 시작해요. 양식은 법원 전자등기 사이트에서 다운로드 가능하고, 생각보다 자주 놓쳐서 과태료 내는 분들 많으세요.",
        sentiment: "negative", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "쇼핑몰대표",
        content: "서류 준비 중 가장 헷갈렸던 게 정관이었어요. 표준 양식 있는데 업종별로 조정해야 하는 부분이 있거든요. 예를 들어 전자상거래업이면 통신판매 관련 조항 추가해야 하고, 서비스업이면 또 다르고. 처음 하시는 분들은 법무사한테 맡기는 게 편합니다.",
        sentiment: "neutral", is_question: false, tier: "detailed",
        replies: [
          {
            persona: "세무사실장10년",
            content: "정관 목적사업 설정도 중요해요. 나중에 사업 확장 시 목적사업에 없으면 변경등기 해야 해서 비용 또 나가거든요. 처음부터 넓게 설정하는 게 좋아요.",
            sentiment: "neutral", reply_type: "supplement", tier: "detailed"
          }
        ]
      },
      {
        persona: "초보창업마케터",
        content: "법인설립 서류 12종 체크리스트 딱 필요했어요. 하나씩 체크하면서 준비하면 되겠네요. 임원변경등기까지 설명해주셔서 감사합니다.",
        sentiment: "positive", is_question: false, tier: "normal",
        replies: []
      },
      {
        persona: "할일미루기왕",
        content: "12종이라니 ㅋㅋ 이거 보고 법인설립 포기할 뻔",
        sentiment: "negative", is_question: false, tier: "casual",
        replies: [
          {
            persona: "공감중독자",
            content: "12종에서 이미 탈주하고 싶음 ㅋㅋ",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "짧게한마디",
        content: "프린트",
        sentiment: "neutral", is_question: false, tier: "quick",
        replies: []
      }
    ]
  },

  // ════════════════════════════════════════════════════════
  // 법인 10. 법인 대표이사 급여 최적화
  // ════════════════════════════════════════════════════════
  {
    slug: "corporation-ceo-salary-optimization",
    batch: "manual_claude_phase89_ceo_salary",
    template: "expert_qa",
    discussions: [
      {
        persona: "세무사실장10년",
        content: "대표이사 급여 최적화의 핵심은 급여 + 배당 + 퇴직금 조합이에요. 급여만 높이면 원천세 + 4대보험 부담 커지고, 배당만 받으면 건강보험료 폭탄 맞아요. 월 300~500 급여 + 연말 배당 + 장기 퇴직금 구조가 가장 일반적이고, 실효세율 최저로 만들 수 있어요. 2026년 세법 개정 후 배당소득세 구간이 바뀌어서 재계산 필수입니다.",
        sentiment: "neutral", is_question: false, tier: "expert",
        replies: [
          {
            persona: "쇼핑몰대표",
            content: "저도 이 구조로 가고 있어요. 처음엔 월 700 받다가 세금 폭탄 맞고 400으로 내리고 배당으로 나머지 받는 구조로 바꿨습니다.",
            sentiment: "positive", reply_type: "agree", tier: "casual"
          }
        ]
      },
      {
        persona: "법무사사무원",
        content: "중임등기 관련해서 추가로 말씀드리면, 대표이사 임기 만료 시 중임 결의 안 하면 법적으로 대표이사 지위가 끝나요. 임기 3년이 일반적인데 이 시점에 중임등기 안 하면 과태료 + 법적 효력 문제 생깁니다. 중임과 동시에 급여 구조 재조정하는 분들도 많고요.",
        sentiment: "neutral", is_question: false, tier: "detailed",
        replies: []
      },
      {
        persona: "세무사실장10년",
        content: "대표 급여 결정 시 체크 포인트 3가지. 1) 동종업계 평균 대비 합리적이어야 세무조사 대비 안전, 2) 법인 이익 대비 과도한 급여는 손금 부인 가능, 3) 급여 변동 시 이사회 결의 필수. 이 3가지 놓치면 세무조사 시 추징당할 수 있어요.",
        sentiment: "negative", is_question: false, tier: "expert",
        replies: [
          {
            persona: "예비창업자J",
            content: "동종업계 평균이라는 게 어디서 확인 가능한가요? 저는 감이 안 오거든요.",
            sentiment: "neutral", reply_type: "answer", tier: "casual"
          }
        ]
      },
      {
        persona: "초보창업마케터",
        content: "배당 조합 전략 진짜 복잡하네요. 세무사 붙이지 않으면 못할 것 같아요. 혼자 하려다 세금 폭탄 맞느니 수수료 주고 맡기는 게 낫겠어요.",
        sentiment: "neutral", is_question: false, tier: "normal",
        replies: [
          {
            persona: "세무사실장10년",
            content: "네 세무사 비용 월 20~30만원이면 연 300만원인데, 이걸로 실효세율 5%p만 줄여도 수백만원 절감 가능해요. 투자 가치 충분합니다.",
            sentiment: "positive", reply_type: "supplement", tier: "normal"
          }
        ]
      },
      {
        persona: "사장님은힘들어",
        content: "급여 최적화 듣기만 해도 머리 아파요 ㅠㅠ 그냥 월급 받고 살고 싶다",
        sentiment: "negative", is_question: false, tier: "casual",
        replies: [
          {
            persona: "웃기면살아남",
            content: "월급쟁이가 부러운 사장님 ㅋㅋ 공감합니다",
            sentiment: "positive", reply_type: "agree", tier: "quick"
          }
        ]
      },
      {
        persona: "읽고감",
        content: "세무사 알아봐야겠네요",
        sentiment: "positive", is_question: false, tier: "quick",
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
    commentOffset += Math.random() * 2 + 0.5;

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
  console.log(`Phase 8.9 각본 직접 삽입 시작 (${SCRIPTS.length}개)\n`);

  const baseDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  let grandTotal = { comments: 0, replies: 0 };

  for (let i = 0; i < SCRIPTS.length; i++) {
    const script = SCRIPTS[i];
    const postBase = new Date(baseDate.getTime() + i * 12 * 60 * 60 * 1000).toISOString();
    process.stdout.write(`[${i + 1}/${SCRIPTS.length}] ${script.slug}\n`);

    const { totalComments, totalReplies } = await insertPost(script, postBase);
    grandTotal.comments += totalComments;
    grandTotal.replies += totalReplies;
    console.log(`  → 댓글 ${totalComments}개, 대댓글 ${totalReplies}개\n`);
  }

  console.log(`\n완료: 총 댓글 ${grandTotal.comments}개, 대댓글 ${grandTotal.replies}개`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

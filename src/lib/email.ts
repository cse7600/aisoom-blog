/**
 * 뉴스레터 이메일 발송 — Resend
 */

import { Resend } from "resend";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY 미설정");
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM ?? "꿀정보 뉴스레터 <noreply@updates.puzl.co.kr>";

export interface NewsletterPayload {
  to: string[];
  subject: string;
  html: string;
}

export async function sendNewsletter(payload: NewsletterPayload): Promise<void> {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });
  if (error) throw new Error(`Resend 오류: ${error.message}`);
}

export async function sendWelcomeEmail(to: string): Promise<void> {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: "꿀정보 뉴스레터 구독 완료",
    html: `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>꿀정보 뉴스레터 구독 완료</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="background:#1c1917;padding:32px 40px;">
              <p style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">꿀정보</p>
              <p style="margin:4px 0 0;color:#a8a29e;font-size:13px;">찐 비교, 찐 추천</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1c1917;letter-spacing:-0.5px;">구독해주셔서 감사합니다</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#44403c;">이제 꼭 필요한 정보만 골라서 보내드립니다. 광고 없이, 뻔한 추천 없이 — 직접 비교하고 테스트한 것만.</p>
              <p style="margin:0 0 8px;font-size:14px;color:#78716c;">보내드리는 내용:</p>
              <ul style="margin:0 0 32px;padding-left:20px;font-size:14px;line-height:1.8;color:#44403c;">
                <li>이번 주 가장 핫한 비교 리뷰</li>
                <li>가격이 내려간 추천 제품 알림</li>
                <li>아무도 말 안 해주는 금융 꿀팁</li>
              </ul>
              <a href="https://www.factnote.co.kr" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;">최신 글 보러 가기</a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f5f5f4;">
              <p style="margin:0;font-size:12px;color:#a8a29e;">수신을 원하지 않으시면 <a href="https://www.factnote.co.kr/unsubscribe?email=${encodeURIComponent(to)}" style="color:#a8a29e;">구독 취소</a>하세요.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });
  if (error) throw new Error(`Resend 오류: ${error.message}`);
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/email";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: { email?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "올바른 이메일 주소를 입력하세요" }, { status: 400 });
  }

  const source = typeof body.source === "string" ? body.source : "website";
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("email_subscribers")
    .select("id, status")
    .eq("email", email)
    .single();

  if (existing) {
    if (existing.status === "active") {
      return NextResponse.json({ ok: true, message: "이미 구독 중입니다" });
    }
    await supabase
      .from("email_subscribers")
      .update({ status: "active", resubscribed_at: new Date().toISOString() })
      .eq("id", existing.id);
    return NextResponse.json({ ok: true, message: "재구독 완료" });
  }

  const { error: insertError } = await supabase.from("email_subscribers").insert({
    email,
    source,
    status: "active",
  });

  if (insertError) {
    console.error("[subscribe] insert error:", insertError.message);
    return NextResponse.json({ error: "구독 처리 중 오류가 발생했습니다" }, { status: 500 });
  }

  try {
    await sendWelcomeEmail(email);
  } catch (err) {
    console.error("[subscribe] welcome email error:", err);
    // 이메일 실패해도 구독은 성공 처리
  }

  return NextResponse.json({ ok: true, message: "구독 완료! 확인 메일을 보내드렸습니다" });
}

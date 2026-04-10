import { NextResponse } from "next/server";

interface TrackClickBody {
  linkId: string;
  platform: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TrackClickBody;

    if (!body.linkId || !body.platform) {
      return NextResponse.json(
        { error: "linkId와 platform은 필수 항목입니다." },
        { status: 400 }
      );
    }

    // Supabase 연동 후 실제 클릭 기록 저장 예정
    // 현재는 성공 응답만 반환

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "요청 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}

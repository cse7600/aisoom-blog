import type { Metadata } from "next";
import Link from "next/link";
import { CommunityWriteForm } from "@/components/community/CommunityWriteForm";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "글쓰기 · 소통",
  description: "소통 게시판에 글을 남겨 보세요. 마케팅·광고·도배 글은 삭제됩니다.",
  alternates: { canonical: `${SITE_CONFIG.url}/community/write` },
  robots: { index: false, follow: true },
};

export default function CommunityWritePage() {
  return (
    <div className="community-page community-page--write">
      <header className="community-page__hero">
        <div>
          <h1 className="community-page__title">글쓰기</h1>
          <p className="community-page__subtitle">
            마케팅/광고/도배 글은 삭제될 수 있어요.
          </p>
        </div>
        <Link href="/community" className="community-page__back">
          목록으로
        </Link>
      </header>
      <CommunityWriteForm />
    </div>
  );
}

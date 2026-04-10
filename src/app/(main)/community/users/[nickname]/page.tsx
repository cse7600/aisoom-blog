import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPersonaByNickname,
  getPersonaRecentActivity,
} from "@/lib/discussion-db";
import type {
  PersonaRow,
  PostDiscussionRow,
  DiscussionReplyRow,
} from "@/lib/discussion-types";
import { SITE_CONFIG } from "@/lib/constants";
import { PersonaProfileJsonLd } from "./profile-jsonld";

interface ProfilePageProps {
  params: { nickname: string };
}

const AUTHORITY_LABEL: Record<PersonaRow["authority_level"], string> = {
  low: "입문",
  mid: "실사용자",
  high: "경력자",
  expert: "전문가",
};

const AUTHORITY_TONE: Record<PersonaRow["authority_level"], string> = {
  low: "bg-stone-100 text-stone-700",
  mid: "bg-sky-100 text-sky-700",
  high: "bg-emerald-100 text-emerald-700",
  expert: "bg-amber-100 text-amber-800",
};

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const nickname = decodeURIComponent(params.nickname);
  const persona = await getPersonaByNickname(nickname);
  if (!persona) {
    return {
      title: `${nickname} | 꿀정보 커뮤니티 프로필`,
    };
  }
  const description = persona.bio ?? `${persona.nickname}의 커뮤니티 프로필`;
  return {
    title: `${persona.nickname} 프로필 | 꿀정보 커뮤니티`,
    description,
    openGraph: {
      type: "profile",
      title: `${persona.nickname} | 꿀정보 커뮤니티`,
      description,
      url: `${SITE_CONFIG.url}/community/users/${encodeURIComponent(persona.nickname)}`,
    },
  };
}

export default async function PersonaProfilePage({ params }: ProfilePageProps) {
  const nickname = decodeURIComponent(params.nickname);
  const persona = await getPersonaByNickname(nickname);
  if (!persona) notFound();

  const activity = await getPersonaRecentActivity(persona.id, 20);
  const profileUrl = `${SITE_CONFIG.url}/community/users/${encodeURIComponent(persona.nickname)}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PersonaProfileJsonLd persona={persona} profileUrl={profileUrl} />
      <ProfileHeader persona={persona} />
      <ExpertiseChips domains={persona.expertise_domains} />
      <NoticeBanner />
      <RecentDiscussions items={activity.discussions} />
      <RecentReplies items={activity.replies} />
    </div>
  );
}

function ProfileHeader({ persona }: { persona: PersonaRow }) {
  return (
    <header className="mb-6 rounded-2xl border border-stone-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-stone-900">{persona.nickname}</h1>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${AUTHORITY_TONE[persona.authority_level]}`}
        >
          {AUTHORITY_LABEL[persona.authority_level]}
        </span>
      </div>
      {persona.occupation && (
        <p className="mt-2 text-sm text-stone-500">{persona.occupation}</p>
      )}
      {persona.bio && (
        <p className="mt-4 text-sm leading-relaxed text-stone-700">{persona.bio}</p>
      )}
    </header>
  );
}

function ExpertiseChips({ domains }: { domains: string[] }) {
  if (domains.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
        관심 분야
      </h2>
      <ul className="flex flex-wrap gap-2">
        {domains.map((domain) => (
          <li
            key={domain}
            className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700"
          >
            #{domain}
          </li>
        ))}
      </ul>
    </section>
  );
}

function NoticeBanner() {
  return (
    <aside className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
      이 프로필은 꿀정보 커뮤니티 페르소나 계정입니다. 경험 기반 토론을 시뮬레이션합니다.
    </aside>
  );
}

function RecentDiscussions({ items }: { items: PostDiscussionRow[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-stone-900">최근 댓글</h2>
      <ul className="space-y-3">
        {items.map((discussion) => (
          <li
            key={discussion.id}
            className="rounded-lg border border-stone-200 bg-white p-4 text-sm"
          >
            <Link
              href={`/${discussion.post_slug}`}
              className="font-medium text-sky-700 hover:underline"
            >
              {discussion.post_slug}
            </Link>
            <p className="mt-2 whitespace-pre-line text-stone-700">
              {discussion.content}
            </p>
            <time className="mt-2 block text-xs text-stone-400">
              {formatDate(discussion.created_at)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecentReplies({ items }: { items: DiscussionReplyRow[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-stone-900">최근 답글</h2>
      <ul className="space-y-2">
        {items.map((reply) => (
          <li
            key={reply.id}
            className="rounded-lg border border-stone-100 bg-stone-50 p-3 text-xs text-stone-700"
          >
            <p className="whitespace-pre-line">{reply.content}</p>
            <time className="mt-2 block text-[10px] text-stone-400">
              {formatDate(reply.created_at)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

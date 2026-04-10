import { runAllHealthChecks, type HealthCheck, type HealthSeverity } from "@/lib/seo-health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "SEO Health — 내부 툴",
  robots: "noindex, nofollow",
};

const SEVERITY_TONE: Record<HealthSeverity, string> = {
  ok: "bg-emerald-50 border-emerald-200 text-emerald-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  critical: "bg-rose-50 border-rose-200 text-rose-800",
};

const SEVERITY_LABEL: Record<HealthSeverity, string> = {
  ok: "정상",
  warning: "주의",
  critical: "경고",
};

export default async function SeoHealthPage() {
  const checks = await runAllHealthChecks();
  const alertCount = checks.filter((check) => check.severity !== "ok").length;

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-stone-50 px-6 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-stone-500">Phase 8.6 Ops</p>
        <h1 className="mt-1 text-3xl font-bold text-stone-900">SEO Health Dashboard</h1>
        <p className="mt-2 text-sm text-stone-600">
          최근 7일 AI 커뮤니티 생성 패턴 지표. {alertCount > 0
            ? `${alertCount}개 항목 조치 필요`
            : "모든 지표 정상"}
        </p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2">
        {checks.map((check) => (
          <HealthCard key={check.id} check={check} />
        ))}
      </section>
      <Footnote />
    </main>
  );
}

function HealthCard({ check }: { check: HealthCheck }) {
  return (
    <article
      className={`rounded-xl border p-5 ${SEVERITY_TONE[check.severity]}`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{check.label}</h2>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase">
          {SEVERITY_LABEL[check.severity]}
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight">
        {check.value}
        <span className="ml-1 text-sm font-medium text-stone-500">{check.unit}</span>
      </p>
      <p className="mt-2 text-xs text-stone-600">{check.detail}</p>
      <p className="mt-1 text-[11px] text-stone-500">
        경계 {check.threshold.warning} / 치명 {check.threshold.critical}
      </p>
    </article>
  );
}

function Footnote() {
  return (
    <footer className="mt-10 rounded-lg border border-stone-200 bg-white p-4 text-xs text-stone-500">
      이 페이지는 내부 운영 전용이며 검색엔진 색인에서 제외됩니다. Vercel Cron 에서 매일 KST 09:00 에
      monitor-seo-health.mjs 가 동일한 지표를 이메일로 보고합니다.
    </footer>
  );
}

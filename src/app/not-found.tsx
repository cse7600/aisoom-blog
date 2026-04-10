import Link from "next/link";
import { SITE_CONFIG } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <p className="text-display-lg font-bold text-primary mb-4">404</p>
        <h1 className="text-heading-lg font-bold text-foreground mb-2">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-body-md text-foreground/50 mb-8">
          요청하신 페이지가 존재하지 않거나, 이동되었을 수 있습니다.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-button hover:bg-primary-hover transition-all shadow-card-sm"
        >
          {SITE_CONFIG.name} 홈으로
        </Link>
      </div>
    </div>
  );
}

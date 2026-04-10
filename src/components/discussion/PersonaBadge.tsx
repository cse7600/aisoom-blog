import { formatRelativeDate } from "@/lib/utils";
import type { PersonaRow, PersonaType } from "@/lib/discussion-types";

interface PersonaBadgeProps {
  persona: PersonaRow;
  createdAt: string;
}

const TYPE_LABEL: Record<PersonaType, string> = {
  worker: "직장인",
  student: "학생",
  parent: "부모",
  business: "자영업",
  techie: "IT",
};

const TYPE_COLOR: Record<PersonaType, string> = {
  worker: "persona-worker",
  student: "persona-student",
  parent: "persona-parent",
  business: "persona-business",
  techie: "persona-techie",
};

export function PersonaBadge({ persona, createdAt }: PersonaBadgeProps) {
  const typeClass = TYPE_COLOR[persona.persona_type];
  const label = TYPE_LABEL[persona.persona_type];
  const occupation = persona.occupation ?? label;

  return (
    <div className="flex items-center gap-2 text-caption">
      <span className={`persona-chip ${typeClass}`} aria-label={label}>
        {label[0]}
      </span>
      <span className="font-semibold text-foreground">{persona.nickname}</span>
      <span className="text-foreground/50">· {occupation}</span>
      <span className="text-foreground/40" aria-hidden>·</span>
      <time dateTime={toIsoString(createdAt)} className="text-foreground/40">
        {formatRelativeDate(createdAt)}
      </time>
    </div>
  );
}

function toIsoString(dateString: string): string {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return dateString;
  return parsed.toISOString();
}

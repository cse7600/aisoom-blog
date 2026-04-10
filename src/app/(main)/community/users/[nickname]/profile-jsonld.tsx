import type { PersonaRow } from "@/lib/discussion-types";

interface PersonaProfileJsonLdProps {
  persona: PersonaRow;
  profileUrl: string;
}

interface PersonSchema {
  "@context": "https://schema.org";
  "@type": "Person";
  name: string;
  description: string;
  url: string;
  knowsAbout?: string[];
  jobTitle?: string;
}

interface ProfilePageSchema {
  "@context": "https://schema.org";
  "@type": "ProfilePage";
  mainEntity: PersonSchema;
  url: string;
  name: string;
}

export function PersonaProfileJsonLd({ persona, profileUrl }: PersonaProfileJsonLdProps) {
  const person: PersonSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: persona.nickname,
    description: persona.bio ?? `${persona.nickname} 커뮤니티 프로필`,
    url: profileUrl,
  };
  if (persona.expertise_domains.length > 0) {
    person.knowsAbout = persona.expertise_domains;
  }
  if (persona.occupation) {
    person.jobTitle = persona.occupation;
  }

  const profilePage: ProfilePageSchema = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: person,
    url: profileUrl,
    name: `${persona.nickname} 프로필`,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(profilePage) }}
    />
  );
}

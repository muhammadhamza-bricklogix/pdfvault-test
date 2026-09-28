import ar from "@/messages/landing/ar.json";
import de from "@/messages/landing/de.json";
import en from "@/messages/landing/en.json";
import es from "@/messages/landing/es.json";
import fr from "@/messages/landing/fr.json";
import pt from "@/messages/landing/pt.json";

const messages = { en, de, fr, es, pt, ar } as const;

export type LandingLocale = keyof typeof messages;
export type LandingMessages = typeof en;

export function getLandingMessages(locale: string): LandingMessages {
  return (messages as Record<string, LandingMessages>)[locale] ?? messages.en;
}

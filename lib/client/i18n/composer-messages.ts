import ar from "@/messages/composer/ar.json";
import de from "@/messages/composer/de.json";
import en from "@/messages/composer/en.json";
import es from "@/messages/composer/es.json";
import fr from "@/messages/composer/fr.json";
import pt from "@/messages/composer/pt.json";

const messages = { en, de, fr, es, pt, ar } as const;

export type ComposerLocale = keyof typeof messages;
export type ComposerMessages = typeof en;

export function getComposerMessages(locale: string): ComposerMessages {
  return (messages as Record<string, ComposerMessages>)[locale] ?? messages.en;
}

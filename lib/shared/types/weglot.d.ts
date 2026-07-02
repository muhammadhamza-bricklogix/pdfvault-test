interface WeglotInstance {
  initialize: (options: {
    api_key: string;
    originalLanguage?: string;
    destinationLanguages?: string;
  }) => void;
  switchTo: (lang: string) => void;
  getCurrentLang: () => string;
  on: (event: string, cb: (newLang: string) => void) => void;
  off: (event: string, cb: (newLang: string) => void) => void;
}

declare global {
  interface Window {
    Weglot?: WeglotInstance;
  }
}

export {};

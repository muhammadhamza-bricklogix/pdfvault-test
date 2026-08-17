interface WeglotInstance {
  initialize: (options: {
    api_key: string;
    originalLanguage?: string;
    destinationLanguages?: string;
    /** Empty array disables Weglot's built-in floating switcher — we
     *  render our own in the header / navbar. */
    switchers?: unknown[];
    /** Legacy option name for the same behavior on older builds. */
    hide_switcher?: boolean;
  }) => void;
  switchTo: (lang: string) => void;
  getCurrentLang: () => string;
  on: (event: string, cb: (newLang: string) => void) => void;
  off: (event: string, cb: (newLang: string) => void) => void;
  /** Triggers a re-scan of the DOM. Useful after client-side subtree
   *  swaps (tab changes, dynamic renders) where Weglot's own
   *  MutationObserver misses the transition. Present on modern Weglot
   *  builds. Optional so older bundles compile cleanly. */
  search?: () => void;
}

declare global {
  interface Window {
    Weglot?: WeglotInstance;
  }
}

export {};

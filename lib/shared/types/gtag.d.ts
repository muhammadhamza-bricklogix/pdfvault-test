interface GtagConversionParams {
  send_to: string;
  transaction_id?: string;
}

type Gtag = {
  (command: "js", date: Date): void;
  (command: "config", targetId: string): void;
  (command: "event", action: "conversion", params: GtagConversionParams): void;
};

type Uetq = {
  push: (...args: unknown[]) => void;
  q?: unknown[];
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    uetq?: unknown[] | Uetq;
  }
}

export {};

interface GtagConversionParams {
  send_to: string;
  transaction_id?: string;
}

type GtagEventParams = Record<string, unknown>;

type Gtag = {
  (command: "js", date: Date): void;
  (command: "config", targetId: string, config?: Record<string, unknown>): void;
  (command: "set", params: Record<string, unknown>): void;
  (command: "get", targetId: string, field: string, callback: (val: unknown) => void): void;
  (command: "event", action: "conversion", params: GtagConversionParams): void;
  (command: "event", action: string, params?: GtagEventParams): void;
};

type Uetq = {
  push: (...args: unknown[]) => void;
  q?: unknown[];
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

interface GtagConversionParams {
  send_to: string;
  transaction_id?: string;
}

type Gtag = {
  (command: "js", date: Date): void;
  (command: "config", targetId: string): void;
  (command: "event", action: "conversion", params: GtagConversionParams): void;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

export {};

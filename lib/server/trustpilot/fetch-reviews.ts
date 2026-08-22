/**
 * Trustpilot Content API reader for the landing-page testimonial section.
 *
 * Public reviews are fetched from Trustpilot's Content API:
 *   GET /v1/business-units/{businessUnitId}/reviews?apikey=…
 *
 * Auth is a single query-param API key (Trustpilot Content API is
 * bearer-less for public review data). Response is cached in the Next.js
 * data cache for 15 minutes — reviews don't change second-to-second, and
 * every landing-page hit would otherwise burn Trustpilot rate limit.
 *
 * On any failure (env vars missing, network fail, malformed response) we
 * return `null` — the caller falls back to the hardcoded testimonials so
 * the landing page never breaks because of Trustpilot flakiness.
 */

const TRUSTPILOT_API_BASE = "https://api.trustpilot.com/v1";
const CACHE_TTL_SECONDS = 15 * 60;

/** Public shape used by the landing-page testimonial UI. */
export type TrustpilotReview = {
  id: string;
  stars: number;
  title: string;
  text: string;
  consumerName: string;
  consumerImageUrl: string | null;
  createdAt: string;
};

type ApiConsumer = {
  displayName?: string;
  imageUrl?: string;
};

type ApiReview = {
  id?: string;
  stars?: number;
  title?: string;
  text?: string;
  createdAt?: string;
  consumer?: ApiConsumer;
};

type ApiResponse = {
  reviews?: ApiReview[];
};

type FetchOptions = {
  /**
   * Filter to only include reviews at or above this star rating. Defaults
   * to 4 — landing-page testimonials shouldn't ship 1/2-star complaints.
   */
  minStars?: number;
  /** Max reviews to return. Trustpilot's `perPage` maxes at 100. */
  perPage?: number;
};

/**
 * Fetches recent high-rated Trustpilot reviews. Returns `null` when env
 * config is missing OR the API call fails — the caller must have a
 * fallback (hardcoded testimonials).
 */
export async function fetchTrustpilotReviews(
  opts: FetchOptions = {},
): Promise<TrustpilotReview[] | null> {
  const apiKey = process.env.TRUSTPILOT_API_KEY?.trim();
  const businessUnitId = process.env.TRUSTPILOT_BUSINESS_UNIT_ID?.trim();

  if (!apiKey || !businessUnitId) {
    // Not an error — just means the integration hasn't been configured yet.
    return null;
  }

  const minStars = opts.minStars ?? 4;
  const perPage = Math.min(opts.perPage ?? 20, 100);

  // Trustpilot's `stars` param can repeat (`&stars=4&stars=5`) to include
  // multiple ratings. Build the range from `minStars` up to 5.
  const url = new URL(
    `${TRUSTPILOT_API_BASE}/business-units/${encodeURIComponent(businessUnitId)}/reviews`,
  );

  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("perPage", String(perPage));
  url.searchParams.set("orderBy", "createdat.desc");
  for (let s = minStars; s <= 5; s += 1) {
    url.searchParams.append("stars", String(s));
  }

  let res: Response;

  try {
    res = await fetch(url.toString(), {
      // Next.js data cache. Bypasses the fetch for 15 min so the landing
      // page renders instantly and Trustpilot isn't hammered per pageview.
      next: { revalidate: CACHE_TTL_SECONDS },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[trustpilot] fetch failed", err);

    return null;
  }

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error("[trustpilot] non-ok response", {
      status: res.status,
      statusText: res.statusText,
    });

    return null;
  }

  let body: ApiResponse;

  try {
    body = (await res.json()) as ApiResponse;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[trustpilot] response not JSON", err);

    return null;
  }

  const raw = body.reviews;

  if (!Array.isArray(raw) || raw.length === 0) return null;

  const reviews: TrustpilotReview[] = [];

  for (const r of raw) {
    if (
      typeof r.id !== "string" ||
      typeof r.stars !== "number" ||
      typeof r.text !== "string" ||
      r.text.trim().length === 0
    ) {
      continue;
    }
    reviews.push({
      id: r.id,
      stars: r.stars,
      title: typeof r.title === "string" ? r.title : "",
      text: r.text,
      consumerName: r.consumer?.displayName?.trim() || "Trustpilot reviewer",
      consumerImageUrl: r.consumer?.imageUrl ?? null,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
    });
  }

  return reviews.length > 0 ? reviews : null;
}

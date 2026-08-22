import type { TrustpilotReview } from "@/lib/server/trustpilot/fetch-reviews";

import { fetchTrustpilotReviews } from "@/lib/server/trustpilot/fetch-reviews";

import { SectionHeading } from "./section-heading";

type Testimonial = {
  name: string;
  handle: string;
  quote: string;
  imageUrl: string;
  /** Star rating (1–5). When set the card renders Trustpilot's star row. */
  stars?: number;
};

/**
 * Stable pravatar seed (1–70) derived from a display name so a reviewer
 * whose Trustpilot profile has no photo still gets a consistent avatar
 * between page loads.
 */
function pravatarSeedFromName(name: string): number {
  let hash = 0;

  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }

  return Math.abs(hash) % 70 || 1;
}

function trustpilotToTestimonial(review: TrustpilotReview): Testimonial {
  const seed = pravatarSeedFromName(review.consumerName);

  return {
    name: review.consumerName,
    // Handle used as React key; ensure uniqueness with the review id.
    handle: review.id,
    quote: review.text,
    imageUrl: review.consumerImageUrl ?? `https://i.pravatar.cc/80?img=${seed}`,
    stars: review.stars,
  };
}

// Fallback testimonials — shown when TRUSTPILOT_API_KEY /
// TRUSTPILOT_BUSINESS_UNIT_ID env vars are unset or the API call fails.
// Keeps the landing page functional even if the integration is down.
const FALLBACK_ROW_ONE: Testimonial[] = [
  {
    name: "Sarah Chen",
    handle: "sarahchen",
    quote:
      "Just integrated @Pdfvault into my workflow and it's a game changer for document management! 🚀",
    imageUrl: "https://i.pravatar.cc/80?img=47",
  },
  {
    name: "Alex Reyes",
    handle: "alexreyes",
    quote:
      "Can't believe I was managing my PDFs without @Pdfvault before. It's a must-have tool! 📚",
    imageUrl: "https://i.pravatar.cc/80?img=12",
  },
  {
    name: "Jasmine Patel",
    handle: "jasminepatel",
    quote:
      "Shoutout to @Pdfvault for making collaborative document editing a breeze. Highly recommend! 💻✨",
    imageUrl: "https://i.pravatar.cc/80?img=25",
  },
  {
    name: "Ethan Brooks",
    handle: "ethanbrooks",
    quote:
      "Merging and signing contracts used to take ages. With @Pdfvault it's a couple of clicks. ✍️",
    imageUrl: "https://i.pravatar.cc/80?img=13",
  },
];

const FALLBACK_ROW_TWO: Testimonial[] = [
  {
    name: "Morgan Linton",
    handle: "morganlinton",
    quote:
      "If you're coding with AI, and haven't discovered @Pdfvault yet, prepare to have your mind blown 🤯",
    imageUrl: "https://i.pravatar.cc/80?img=15",
  },
  {
    name: "Jessica Tran",
    handle: "jessicatran",
    quote:
      "Pdfvault has transformed my workflow. Editing PDFs has never been so seamless! 🚀",
    imageUrl: "https://i.pravatar.cc/80?img=32",
  },
  {
    name: "David Kim",
    handle: "davidkim",
    quote:
      "The features are intuitive, and the interface is sleek. Pdfvault is a game changer! 💼",
    imageUrl: "https://i.pravatar.cc/80?img=17",
  },
  {
    name: "Samantha Lee",
    handle: "samanthalee",
    quote:
      "I can't believe how easy it is to collaborate on documents with Pdfvault. It's a must-have tool! 🙌",
    imageUrl: "https://i.pravatar.cc/80?img=45",
  },
];

function StarRow({ stars }: { stars: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(stars)));

  return (
    <div
      aria-label={`${filled} out of 5 stars`}
      className="flex items-center gap-0.5"
      role="img"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          aria-hidden="true"
          className={i < filled ? "text-[#00b67a]" : "text-[var(--pv-gray-4)]"}
          fill="currentColor"
          height="16"
          viewBox="0 0 24 24"
          width="16"
        >
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({ data }: { data: Testimonial }) {
  return (
    <article className="mr-5 flex w-[340px] shrink-0 flex-col rounded-[var(--pv-radius-card)] border border-[var(--pv-card-border)] bg-white p-6">
      <header className="flex items-center gap-3">
        {/* Photo avatar — Trustpilot's own imageUrl when present, else a
            stable pravatar per reviewer name. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="size-10 shrink-0 rounded-full object-cover"
          loading="lazy"
          src={data.imageUrl}
        />
        <div className="leading-tight">
          <p className="text-[15px] font-semibold text-[var(--pv-text-primary)]">
            {data.name}
          </p>
          {data.stars !== undefined ? (
            <div className="mt-1">
              <StarRow stars={data.stars} />
            </div>
          ) : (
            <p className="text-[13px] text-[var(--pv-text-secondary)]">
              @{data.handle}
            </p>
          )}
        </div>
      </header>
      <p className="mt-4 line-clamp-6 text-[15px] leading-relaxed text-[var(--pv-gray-8)]">
        {data.quote}
      </p>
    </article>
  );
}

function MarqueeRow({
  direction,
  items,
}: {
  direction: "left" | "right";
  items: Testimonial[];
}) {
  return (
    <div className="pv-marquee-row overflow-hidden">
      <div
        className={`pv-marquee ${
          direction === "left" ? "pv-marquee-left" : "pv-marquee-right"
        }`}
      >
        {/* The set is rendered twice so the -50% translate loops seamlessly. */}
        {items.map((item) => (
          <TestimonialCard key={item.handle} data={item} />
        ))}
        {items.map((item) => (
          <TestimonialCard key={`${item.handle}-dup`} data={item} />
        ))}
      </div>
    </div>
  );
}

function splitIntoRows(
  testimonials: Testimonial[],
): [Testimonial[], Testimonial[]] {
  const rowOne: Testimonial[] = [];
  const rowTwo: Testimonial[] = [];

  testimonials.forEach((t, i) => {
    if (i % 2 === 0) rowOne.push(t);
    else rowTwo.push(t);
  });

  // Ensure at least 4 cards per row so the -50% marquee loop stays smooth.
  // If Trustpilot returned <8 reviews, we repeat the row until it's dense
  // enough (the marquee already duplicates once for seamless looping, but
  // a very short list would show visible gaps).
  const pad = (row: Testimonial[]): Testimonial[] => {
    if (row.length >= 4) return row;
    const padded: Testimonial[] = [];
    let i = 0;

    while (padded.length < 4 && row.length > 0) {
      const src = row[i % row.length]!;

      padded.push({ ...src, handle: `${src.handle}-r${i}` });
      i += 1;
    }

    return padded;
  };

  return [pad(rowOne), pad(rowTwo)];
}

export async function LandingTestimonials() {
  const reviews = await fetchTrustpilotReviews({ minStars: 4, perPage: 20 });
  const [rowOne, rowTwo] =
    reviews && reviews.length > 0
      ? splitIntoRows(reviews.map(trustpilotToTestimonial))
      : [FALLBACK_ROW_ONE, FALLBACK_ROW_TWO];

  return (
    <section
      aria-labelledby="testimonials-heading"
      className="bg-white py-20 sm:py-24"
    >
      <div className="pv-container">
        <SectionHeading
          title={
            <span id="testimonials-heading">
              See what people are saying about PDFVault.
            </span>
          }
        />
      </div>

      <div className="mt-14 flex flex-col gap-5">
        <MarqueeRow direction="left" items={rowOne} />
        <MarqueeRow direction="right" items={rowTwo} />
      </div>
    </section>
  );
}

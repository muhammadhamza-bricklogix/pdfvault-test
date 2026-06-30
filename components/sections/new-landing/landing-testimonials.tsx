import { SectionHeading } from "./section-heading";

type Testimonial = {
  name: string;
  handle: string;
  quote: string;
};

// Seven quotes are transcribed from the reference; the last entry is a
// placeholder so each row holds four cards (keeps the marquee loop seamless on
// wide screens). Swap real avatars/quotes in here — it is the single source.
const ROW_ONE: Testimonial[] = [
  {
    name: "Sarah Chen",
    handle: "sarahchen",
    quote:
      "Just integrated @Pdfvault into my workflow and it's a game changer for document management! 🚀",
  },
  {
    name: "Alex Reyes",
    handle: "alexreyes",
    quote:
      "Can't believe I was managing my PDFs without @Pdfvault before. It's a must-have tool! 📚",
  },
  {
    name: "Jasmine Patel",
    handle: "jasminepatel",
    quote:
      "Shoutout to @Pdfvault for making collaborative document editing a breeze. Highly recommend! 💻✨",
  },
  {
    name: "Ethan Brooks",
    handle: "ethanbrooks",
    quote:
      "Merging and signing contracts used to take ages. With @Pdfvault it's a couple of clicks. ✍️",
  },
];

const ROW_TWO: Testimonial[] = [
  {
    name: "Morgan Linton",
    handle: "morganlinton",
    quote:
      "If you're coding with AI, and haven't discovered @Pdfvault yet, prepare to have your mind blown 🤯",
  },
  {
    name: "Jessica Tran",
    handle: "jessicatran",
    quote:
      "Pdfvault has transformed my workflow. Editing PDFs has never been so seamless! 🚀",
  },
  {
    name: "David Kim",
    handle: "davidkim",
    quote:
      "The features are intuitive, and the interface is sleek. Pdfvault is a game changer! 💼",
  },
  {
    name: "Samantha Lee",
    handle: "samanthalee",
    quote:
      "I can't believe how easy it is to collaborate on documents with Pdfvault. It's a must-have tool! 🙌",
  },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function TestimonialCard({ data }: { data: Testimonial }) {
  return (
    <article className="mr-5 flex w-[340px] shrink-0 flex-col rounded-[var(--pv-radius-card)] border border-[var(--pv-card-border)] bg-white p-6">
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--pv-gray-3)] text-[13px] font-semibold text-[var(--pv-gray-8)]">
          {getInitials(data.name)}
        </span>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold text-[var(--pv-text-primary)]">
            {data.name}
          </p>
          <p className="text-[13px] text-[var(--pv-text-secondary)]">
            @{data.handle}
          </p>
        </div>
      </header>
      <p className="mt-4 text-[15px] leading-relaxed text-[var(--pv-gray-8)]">
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

export function LandingTestimonials() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="bg-white py-20 sm:py-24"
    >
      <div className="pv-container">
        <SectionHeading
          title={
            <span id="testimonials-heading">
              See what people are saying about pdfvault.
            </span>
          }
        />
      </div>

      <div className="mt-14 flex flex-col gap-5">
        <MarqueeRow direction="left" items={ROW_ONE} />
        <MarqueeRow direction="right" items={ROW_TWO} />
      </div>
    </section>
  );
}

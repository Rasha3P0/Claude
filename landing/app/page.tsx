import WaitlistForm from "@/components/WaitlistForm";
import { BRAND } from "@/config/brand";

const STATS = [
  {
    figure: "2p in every £1",
    context:
      "of UK venture capital goes to all-female founding teams — the same founders most likely to be building in women's health.",
    source: "British Business Bank, Investing in Women Code Annual Report 2025",
  },
  {
    figure: "$2.6 billion",
    context:
      "invested in women's health globally in 2024 — up 55% year-on-year. The demand signal is loud. Capital allocation hasn't caught up.",
    source: "Silicon Valley Bank, Innovation in Women's Health Report 2025",
  },
  {
    figure: "~40×",
    context:
      "economic return modelled from targeted women's health research. $350m of additional investment → ~$14bn in economic returns.",
    source: "WHAM / KPMG, The Business Case for Accelerating Women's Health Investment, January 2026",
  },
];

const PHASES = [
  {
    label: "Phase 1",
    heading: "Community & crowdfunding",
    body: "Rally women and allies to co-invest small amounts into vetted women's health startups via FCA-authorised platforms. Builds audience, track record, and deal flow simultaneously.",
  },
  {
    label: "Phase 2",
    heading: "Angel syndicate",
    body: "Formalise the community into a network writing meaningful cheques. Sign the Investing in Women Code. Build a verified track record of deal performance.",
  },
  {
    label: "Phase 3",
    heading: "The fund",
    body: "Use track record and network to raise a dedicated women's health VC fund — backed by, and accountable to, the community that built it.",
  },
];

export default function Home() {
  const displayName = BRAND.name ?? BRAND.tagline;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <nav className="border-b border-slate-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-semibold tracking-tight text-slate-900">
            {displayName}
          </span>
          <a
            href="#waitlist"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            Register interest
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 md:py-28 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-semibold tracking-widest text-emerald-700 uppercase mb-4">
            Capital in Motion
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6 leading-tight">
            A new way for women to fund the future of their own health.
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-8 leading-relaxed">
            A UK community-funded vehicle backing women&apos;s health ventures.
            Everyday women co-own a stake in the products shaping their own
            healthcare. We&apos;re building the founding community now.
          </p>
          <a
            href="#waitlist"
            className="inline-block bg-slate-900 text-white px-8 py-3 rounded-md font-medium hover:bg-slate-700 transition-colors"
          >
            Join the founding community
          </a>
          <p className="mt-4 text-sm text-slate-400">
            Community interest registration only — not an offer or invitation to invest.
          </p>
        </div>
      </section>

      {/* Problem */}
      <section className="bg-slate-50 px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold tracking-widest text-emerald-700 uppercase mb-2">
            The problem
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
            Two stacked funding gaps — compounding.
          </h2>
          <p className="text-slate-600 max-w-2xl mb-12 leading-relaxed">
            The founders most likely to solve women&apos;s health problems are
            the least likely to get backed. And the field they&apos;re building
            in is chronically under-capitalised. These aren&apos;t separate
            issues — they compound.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STATS.map((stat) => (
              <div
                key={stat.figure}
                className="bg-white rounded-lg p-6 border border-slate-100"
              >
                <p className="text-3xl font-bold text-slate-900 mb-2">
                  {stat.figure}
                </p>
                <p className="text-slate-600 text-sm leading-relaxed mb-3">
                  {stat.context}
                </p>
                <p className="text-xs text-slate-400 italic">{stat.source}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Opportunity */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold tracking-widest text-emerald-700 uppercase mb-2">
            The opportunity
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">
            The market is moving. Community capital can lead.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-600 leading-relaxed">
            <div>
              <p className="mb-4">
                Global women&apos;s health investment hit $2.6 billion in 2024 —
                up 55% year-on-year — yet the sector still captures only a
                fraction of healthcare venture capital. The gap between market
                signal and capital allocation is wide and closing slowly.
              </p>
              <p>
                WHAM&apos;s January 2026 analysis (with KPMG) found that $350
                million of additional targeted research could generate nearly
                $14 billion in economic returns — a ~40× multiple. Closing the
                broader gap in women&apos;s health outcomes could add at least
                $1 trillion to annual global GDP.
              </p>
            </div>
            <div>
              <p className="mb-4">
                The UK government launched a £1.5 million FemTech challenge fund
                under the refreshed Women&apos;s Health Strategy in April 2026.
                The British Business Bank has committed £500 million to diverse
                and emerging fund managers. Policy momentum is building.
              </p>
              <p>
                UK femtech funding dipped in 2025. We read that as an argument{" "}
                <em>for</em> patient, community-rooted capital — not against the
                thesis. A community-built vehicle, investing gradually into
                vetted deals, is better positioned to compound through a cycle
                than a single-vintage fund.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="bg-slate-900 text-white px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold tracking-widest text-emerald-400 uppercase mb-2">
            The vision
          </p>
          <h2 className="text-2xl md:text-3xl font-bold mb-10">
            Three phases. One community building it.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PHASES.map((phase) => (
              <div key={phase.label}>
                <p className="text-xs font-semibold text-emerald-400 tracking-widest uppercase mb-1">
                  {phase.label}
                </p>
                <h3 className="text-lg font-semibold mb-2">{phase.heading}</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {phase.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="px-6 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
            Join the founding community
          </h2>
          <p className="text-slate-600 mb-3 leading-relaxed">
            We&apos;re building the community now — before Phase 1 opens.
            Register your interest to follow our journey and hear first when
            co-investment opportunities become available through FCA-authorised
            platforms.
          </p>
          <p className="text-sm text-slate-400 mb-8">
            This page is a community interest registration only. Nothing here
            constitutes an offer, invitation, or solicitation to invest. Your
            email will be used solely to keep you informed about this
            community&apos;s progress — never shared or sold. You can
            unsubscribe at any time.
          </p>
          <WaitlistForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-6 py-8 text-center">
        <p className="text-sm text-slate-500 mb-1">
          <strong>{displayName}</strong> — community interest registration, not
          a financial promotion.
        </p>
        <p className="text-xs text-slate-400">
          Nothing on this page constitutes an offer or invitation to invest.
          UK-based — by women, for women.
        </p>
      </footer>
    </div>
  );
}

import { ArrowRight, Clock3, MapPin, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import DarkVeil from "../components/background/DarkVeil";

const features = [
  {
    title: "5 km local radius",
    description: "Find rental items near you, fast. No long-distance pickup hassle.",
    icon: MapPin,
  },
  {
    title: "Trust-first profiles",
    description: "Borrow with confidence through profiles, reviews, and trust score visibility.",
    icon: ShieldCheck,
  },
  {
    title: "Quick turnaround",
    description: "List, request, and approve in minutes so useful things never stay idle.",
    icon: Clock3,
  },
];

const stats = [
  { label: "Typical approval speed", value: "< 30 min" },
  { label: "Default search radius", value: "5 km" },
  { label: "Roles supported", value: "Borrower / Lender" },
];

const LandingPage = () => (
  <div className="min-h-screen bg-[#05070b] px-4 py-5 md:px-8 md:py-8">
    <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] border border-zinc-800/80 bg-black/40 text-zinc-100 shadow-mono backdrop-blur-[2px]">
      <div className="pointer-events-none absolute inset-0">
        <DarkVeil
          hueShift={18}
          noiseIntensity={0.02}
          scanlineIntensity={0.08}
          speed={0.5}
          scanlineFrequency={1.1}
          warpAmount={0.1}
          resolutionScale={1}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
      <div className="pointer-events-none absolute -left-28 top-16 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-700/70 px-6 py-5 md:px-8">
        <Link to="/" className="font-display text-xl font-extrabold tracking-tight md:text-2xl">
          BORROWLY
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-xl border border-zinc-600 bg-zinc-900/50 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-800"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
          >
            Create account
          </Link>
        </nav>
      </header>

      <main className="relative z-10 px-6 pb-8 pt-8 md:px-8 md:pb-10 md:pt-10">
        <section className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <p className="inline-flex rounded-full border border-zinc-600 bg-zinc-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-300">
              Hyperlocal Rental Network
            </p>
            <h1 className="mt-4 max-w-xl font-display text-4xl font-extrabold leading-tight md:text-5xl">
              Borrow what you need. Lend what you do not use.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-300 md:text-base">
              Borrowly connects neighbors for short-term rentals. Discover useful items around you, avoid unnecessary
              purchases, and earn from idle gear.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
              >
                Start renting nearby
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/login"
                className="rounded-xl border border-zinc-600 bg-zinc-900/50 px-5 py-3 text-sm font-semibold transition hover:bg-zinc-800"
              >
                I already have an account
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-700 bg-zinc-900/60 p-5 backdrop-blur-sm">
            <h2 className="font-display text-xl font-bold">Platform snapshot</h2>
            <div className="mt-4 space-y-3">
              {stats.map((item) => (
                <div key={item.label} className="rounded-2xl border border-zinc-700 bg-zinc-950/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{item.label}</p>
                  <p className="mt-1 text-lg font-bold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-3 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-4 backdrop-blur-sm">
              <div className="mb-3 inline-flex rounded-lg border border-zinc-600 bg-zinc-950/80 p-2">
                <Icon size={18} />
              </div>
              <h3 className="font-display text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm text-zinc-300">{description}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  </div>
);

export default LandingPage;

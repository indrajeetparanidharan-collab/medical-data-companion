import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Bluetooth,
  FileText,
  Gauge,
  Info,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ModuleLink {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  rail: string;
  iconClass: string;
}

const MODULES: ModuleLink[] = [
  {
    to: "/connect",
    label: "Connect",
    description:
      "Pair a Bluetooth health device and watch your readings arrive live.",
    icon: Bluetooth,
    rail: "bg-accent",
    iconClass: "bg-accent/15 text-accent",
  },
  {
    to: "/predict",
    label: "Predict",
    description:
      "Get a plain-language risk estimate from your latest readings, with the factors behind it.",
    icon: Gauge,
    rail: "bg-primary",
    iconClass: "bg-primary/12 text-primary",
  },
  {
    to: "/record",
    label: "My Record",
    description:
      "Review, add, and export your own health record. Everything stays in this browser.",
    icon: FileText,
    rail: "bg-success",
    iconClass: "bg-success/15 text-success",
  },
  {
    to: "/symptoms",
    label: "Symptoms",
    description:
      "Describe how you feel and see a ranked list of possible conditions to discuss with a clinician.",
    icon: Stethoscope,
    rail: "bg-warning",
    iconClass: "bg-warning/20 text-warning-foreground",
  },
  {
    to: "/how-it-works",
    label: "How It Works",
    description:
      "See the sources and simple rules behind every score and suggestion in this app.",
    icon: Info,
    rail: "bg-chart-5",
    iconClass: "bg-secondary text-secondary-foreground",
  },
  {
    to: "/privacy",
    label: "Privacy",
    description:
      "Understand exactly where your data lives and what never leaves your device.",
    icon: ShieldCheck,
    rail: "bg-primary",
    iconClass: "bg-primary/12 text-primary",
  },
];

const STEPS = [
  {
    title: "Connect a device",
    body: "Pair a supported Bluetooth monitor, or enter readings yourself.",
  },
  {
    title: "See your numbers",
    body: "Readings are charted and scored in plain language, right away.",
  },
  {
    title: "Keep your record",
    body: "Save, review, and export your own record whenever you need it.",
  },
];

/** Home screen: welcome, educational disclaimer, and module navigation. */
export default function HomePage() {
  return (
    <div data-ocid="home.page" className="flex flex-col gap-8">
      {/* Hero */}
      <section
        data-ocid="home.hero"
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-subtle md:p-10"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-accent/10 blur-2xl"
        />
        <div className="relative flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-accent">
            <Activity aria-hidden="true" className="size-3.5" />
            Personal health, kept private
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
            Understand your vitals, on your own terms
          </h1>
          <p className="max-w-prose text-base leading-relaxed text-muted-foreground md:text-lg">
            Vitals Ledger turns readings from your own devices into a clear,
            private record you can read and share with a clinician. No account,
            no signup, and nothing sent to a server.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              data-ocid="home.primary_button"
              className="tap-target rounded-lg bg-gradient-primary text-primary-foreground shadow-subtle transition-smooth hover:shadow-elevated"
            >
              <Link to="/connect">
                Connect a device
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              data-ocid="home.secondary_button"
              className="tap-target rounded-lg"
            >
              <Link to="/how-it-works">See how it works</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Educational disclaimer */}
      <section
        data-ocid="home.disclaimer_section"
        aria-labelledby="home-disclaimer-heading"
        className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-5"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning-foreground">
          <Info aria-hidden="true" className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2
            id="home-disclaimer-heading"
            className="font-display text-base font-bold"
          >
            This is an educational tool, not medical advice
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Vitals Ledger helps you understand your readings and prepare
            questions. It cannot diagnose you or replace a clinician. If you
            feel unwell or think you are having an emergency, call your local
            emergency number right away.
          </p>
        </div>
      </section>

      {/* Modules */}
      <section
        data-ocid="home.modules_section"
        aria-labelledby="home-modules-heading"
        className="flex flex-col gap-4"
      >
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Explore
          </p>
          <h2
            id="home-modules-heading"
            className="font-display text-2xl font-bold tracking-tight"
          >
            Everything in one place
          </h2>
        </header>

        <ul data-ocid="home.module_list" className="flex flex-col gap-3">
          {MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <li key={module.to}>
                <Link
                  to={module.to}
                  data-ocid={`home.module_link.${module.label
                    .toLowerCase()
                    .replace(/\s+/g, "_")}`}
                  className="group relative flex min-h-[4.5rem] items-center gap-4 overflow-hidden rounded-xl border border-border bg-card p-4 pl-5 shadow-subtle transition-smooth hover:border-primary/40 hover:shadow-elevated focus-visible:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-1 ${module.rail}`}
                  />
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-full ${module.iconClass}`}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-display text-base font-bold text-foreground">
                      {module.label}
                    </span>
                    <span className="text-sm leading-snug text-muted-foreground">
                      {module.description}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-5 shrink-0 text-muted-foreground transition-smooth group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* How it works in three steps */}
      <section
        data-ocid="home.steps_section"
        aria-labelledby="home-steps-heading"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/30 p-6"
      >
        <h2
          id="home-steps-heading"
          className="font-display text-2xl font-bold tracking-tight"
        >
          Three simple steps
        </h2>
        <ol className="flex flex-col gap-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">
                {index + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-display text-base font-bold">
                  {step.title}
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

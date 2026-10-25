import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  Download,
  HardDrive,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  WifiOff,
} from "lucide-react";
import type { ReactNode } from "react";

interface PrivacyPoint {
  icon: ReactNode;
  title: string;
  body: string;
}

const STORAGE_POINTS: PrivacyPoint[] = [
  {
    icon: <HardDrive aria-hidden="true" className="size-5" />,
    title: "Your health record",
    body: "Readings, conditions, medications, allergies, and symptom answers you add are saved in this browser's local storage on this device.",
  },
  {
    icon: <WifiOff aria-hidden="true" className="size-5" />,
    title: "Nothing is uploaded",
    body: "There is no account and no server. Your data is never transmitted, synced, or backed up anywhere outside this browser.",
  },
  {
    icon: <ShieldCheck aria-hidden="true" className="size-5" />,
    title: "No trackers or analytics",
    body: "We do not use cookies for tracking, advertising, or analytics. No third party watches how you use this app.",
  },
];

const CONTROL_POINTS: PrivacyPoint[] = [
  {
    icon: <Download aria-hidden="true" className="size-5" />,
    title: "Export your data",
    body: "Open My Record and choose Export to download a JSON or PDF copy of everything stored. Keep that file somewhere safe — it is your only backup.",
  },
  {
    icon: <Trash2 aria-hidden="true" className="size-5" />,
    title: "Clear your data",
    body: "Open My Record and choose Delete all to erase every record from this browser. Clearing your browser's site data also removes it.",
  },
  {
    icon: <UserRoundCheck aria-hidden="true" className="size-5" />,
    title: "No signup required",
    body: "You can use every feature without creating an account or sharing an email address. Nothing identifies you.",
  },
];

function PointCard({ point }: { point: PrivacyPoint }) {
  return (
    <li className="flex gap-3 rounded-xl border border-border bg-card p-4 shadow-subtle">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        {point.icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-display text-base font-semibold text-foreground">
          {point.title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {point.body}
        </p>
      </div>
    </li>
  );
}

/** Privacy screen: plain-language explanation of local-only storage. */
export default function PrivacyPage() {
  return (
    <section data-ocid="privacy.page" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Trust
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Privacy
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Everything you enter stays on this device. Here is exactly what that
          means.
        </p>
      </header>

      <div
        data-ocid="privacy.summary_card"
        className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/10 p-5"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <ShieldCheck aria-hidden="true" className="size-5" />
        </span>
        <p className="text-sm font-medium leading-relaxed text-foreground">
          All data is stored locally in your browser. Nothing is sent to a
          server, and no trackers or analytics are used.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          What is stored, and where
        </h2>
        <ul data-ocid="privacy.storage_list" className="flex flex-col gap-3">
          {STORAGE_POINTS.map((point) => (
            <PointCard key={point.title} point={point} />
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          You are in control
        </h2>
        <ul data-ocid="privacy.control_list" className="flex flex-col gap-3">
          {CONTROL_POINTS.map((point) => (
            <PointCard key={point.title} point={point} />
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/50 p-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Because your data lives only in this browser, it will not follow you
          to another device or browser. Export a copy before clearing your
          browser data or switching devices.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            asChild
            data-ocid="privacy.record_button"
            className="tap-target w-full rounded-lg sm:w-auto"
          >
            <Link to="/record">Go to My Record</Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            data-ocid="privacy.how_it_works_button"
            className="tap-target w-full rounded-lg sm:w-auto"
          >
            <Link to="/how-it-works">How the estimates work</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

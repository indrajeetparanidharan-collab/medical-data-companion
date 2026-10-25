import { EMERGENCY_NUMBER, emergencyTelHref } from "@/lib/emergency";
import { AlertTriangle } from "lucide-react";

/**
 * Persistent educational disclaimer. Sticky at the top of the shell so it is
 * always visible, with the owner-editable emergency number clearly marked.
 */
export function DisclaimerBanner() {
  return (
    <aside
      data-ocid="disclaimer.banner"
      aria-label="Educational disclaimer"
      className="sticky top-0 z-40 border-b border-warning/40 bg-warning/15 px-4 py-2 shadow-subtle backdrop-blur supports-[backdrop-filter]:bg-warning/20"
    >
      <p className="mx-auto flex max-w-3xl items-start gap-2 text-xs leading-snug text-foreground sm:text-sm">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-warning-foreground"
        />
        <span>
          Educational tool — not medical advice. Emergency?{" "}
          <a
            href={emergencyTelHref()}
            data-ocid="disclaimer.emergency_link"
            className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Call {EMERGENCY_NUMBER}
          </a>
          .
        </span>
      </p>
    </aside>
  );
}

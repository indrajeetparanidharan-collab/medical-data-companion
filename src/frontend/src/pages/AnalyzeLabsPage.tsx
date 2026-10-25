import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type AnalysisResult,
  type EnteredValue,
  type RankedCondition,
  SUPPORTED_MARKERS,
  type ValueFlag,
  analyze,
} from "@/lib/analysis";
import {
  type FlagLevel,
  type MarkerReference,
  getMarker,
  inRange,
  toCanonicalValue,
} from "@/lib/clinical";
import { type Observation, create, list } from "@/lib/db";
import { EMERGENCY_NUMBER, emergencyTelHref } from "@/lib/emergency";
import {
  type TrendPoint,
  type TrendResult,
  compareTrend,
  sparklinePoints,
  trendLabel,
} from "@/lib/trends";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  FlaskConical,
  Minus,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** One editable marker row: the raw text plus the unit it was entered in. */
interface MarkerDraft {
  value: string;
  unit: string;
}

type DraftMap = Record<string, MarkerDraft>;

/** Visual treatment for each flag level. */
const LEVEL_STYLE: Record<
  FlagLevel,
  { label: string; dot: string; text: string; chip: string }
> = {
  normal: {
    label: "In range",
    dot: "bg-success",
    text: "text-success",
    chip: "border-success/40 bg-success/10 text-success",
  },
  mild: {
    label: "Mildly out of range",
    dot: "bg-warning",
    text: "text-warning",
    chip: "border-warning/40 bg-warning/10 text-warning",
  },
  moderate: {
    label: "Moderately out of range",
    dot: "bg-warning",
    text: "text-warning",
    chip: "border-warning/40 bg-warning/10 text-warning",
  },
  critical: {
    label: "Critically out of range",
    dot: "bg-destructive",
    text: "text-destructive",
    chip: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

/** Plain-language description of a marker's normal range. */
function rangeText(marker: MarkerReference): string {
  const { min, max } = marker.normal;
  if (min !== null && max !== null) return `${min}–${max} ${marker.unit}`;
  if (max !== null) return `below ${max} ${marker.unit}`;
  if (min !== null) return `above ${min} ${marker.unit}`;
  return marker.unit;
}

/** Classify a canonical value against the marker's cited bands. */
function levelFor(marker: MarkerReference, canonical: number): FlagLevel {
  if (marker.critical && inRange(canonical, marker.critical)) return "critical";
  if (marker.moderate && inRange(canonical, marker.moderate)) return "moderate";
  if (marker.mild && inRange(canonical, marker.mild)) return "mild";
  return "normal";
}

/** Parse a draft value into a finite number, or null when invalid/empty. */
function parseValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

/** A tiny inline sparkline drawn from normalized 0..1 points. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const width = 96;
  const height = 28;
  const step = width / (points.length - 1);
  const path = points
    .map((point, index) => {
      const x = index * step;
      const y = height - point * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      className="h-7 w-24 text-primary"
      preserveAspectRatio="none"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Direction arrow plus label for a trend result. */
function TrendBadge({ trend }: { trend: TrendResult }) {
  const Icon =
    trend.direction === "rising"
      ? ArrowUp
      : trend.direction === "falling"
        ? ArrowDown
        : Minus;
  return (
    <span
      data-ocid={`analyze_labs.trend.${trend.markerId}`}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {trendLabel(trend.direction)}
      {trend.hasHistory && trend.changePercent !== null ? (
        <span className="text-muted-foreground/80">
          ({trend.changePercent > 0 ? "+" : ""}
          {trend.changePercent.toFixed(1)}%)
        </span>
      ) : null}
    </span>
  );
}

export default function AnalyzeLabsPage() {
  const [draft, setDraft] = useState<DraftMap>({});
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<number | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [history, setHistory] = useState<Observation[]>([]);

  // Load prior observations once so trends can compare against them.
  useEffect(() => {
    let active = true;
    list("Observation")
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch(() => {
        if (active) setHistory([]);
      });
    return () => {
      active = false;
    };
  }, []);

  /** Prior readings per marker id, oldest first, in canonical units. */
  const historyByMarker = useMemo(() => {
    const map = new Map<string, TrendPoint[]>();
    for (const row of history) {
      if (row.source !== "manual") continue;
      const marker = getMarker(row.code);
      if (!marker) continue;
      const bucket = map.get(marker.id) ?? [];
      bucket.push({ at: row.effectiveAt, value: row.value });
      map.set(marker.id, bucket);
    }
    return map;
  }, [history]);

  /** Live per-marker evaluation of the current draft. */
  const live = useMemo(() => {
    const entries: {
      marker: MarkerReference;
      canonical: number;
      level: FlagLevel;
    }[] = [];
    for (const marker of SUPPORTED_MARKERS) {
      const row = draft[marker.id];
      if (!row) continue;
      const parsed = parseValue(row.value);
      if (parsed === null) continue;
      const canonical = toCanonicalValue(marker, parsed, row.unit);
      entries.push({ marker, canonical, level: levelFor(marker, canonical) });
    }
    return entries;
  }, [draft]);

  const enteredCount = live.length;

  function setMarkerValue(markerId: string, value: string) {
    setSaveState("idle");
    setDraft((prev) => {
      const marker = getMarker(markerId);
      const current = prev[markerId] ?? {
        value: "",
        unit: marker?.unit ?? "",
      };
      return { ...prev, [markerId]: { ...current, value } };
    });
  }

  function setMarkerUnit(markerId: string, unit: string) {
    setSaveState("idle");
    setDraft((prev) => {
      const marker = getMarker(markerId);
      const current = prev[markerId] ?? {
        value: "",
        unit: marker?.unit ?? "",
      };
      if (current.unit === unit) return prev;
      // Convert the displayed value so the same physical quantity is shown in
      // the new unit. Values are stored in the row's current unit, so convert
      // to canonical first, then into the target unit.
      const parsed = parseValue(current.value);
      let nextValue = current.value;
      if (parsed !== null && marker) {
        const canonical = toCanonicalValue(marker, parsed, current.unit);
        const converted =
          marker.alternate && unit === marker.alternate.unit
            ? canonical / marker.alternate.toCanonical
            : canonical;
        nextValue = String(Number(converted.toFixed(2)));
      }
      return { ...prev, [markerId]: { value: nextValue, unit } };
    });
  }

  function resetAll() {
    setDraft({});
    setResult(null);
    setAnalyzedAt(null);
    setAcknowledged(false);
    setSaveState("idle");
  }

  function runAnalysis() {
    const entries: EnteredValue[] = [];
    for (const marker of SUPPORTED_MARKERS) {
      const row = draft[marker.id];
      if (!row) continue;
      const parsed = parseValue(row.value);
      if (parsed === null) continue;
      entries.push({ markerId: marker.id, value: parsed, unit: row.unit });
    }
    if (entries.length === 0) return;
    const next = analyze(entries);
    setResult(next);
    setAnalyzedAt(Date.now());
    setAcknowledged(false);
    setSaveState("idle");
  }

  async function saveToRecord() {
    if (!result || result.flags.length === 0) return;
    setSaveState("saving");
    const at = analyzedAt ?? Date.now();
    try {
      for (const flag of result.flags) {
        await create("Observation", {
          code: flag.markerId,
          display: flag.markerName,
          value: flag.value,
          unit: flag.unit,
          effectiveAt: at,
          source: "manual",
          notes: flag.explanation,
        });
      }
      for (const condition of result.ranked) {
        await create("Condition", {
          code: condition.id,
          display: condition.name,
          clinicalStatus: "active",
          notes: `${condition.explanation} (${condition.citation})`,
        });
      }
      const rows = await list("Observation");
      setHistory(rows);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  const showEmergency = result?.redFlag === true && !acknowledged;

  return (
    <section data-ocid="analyze_labs.page" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Labs
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Analyze Labs
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Enter your blood-marker results to see which values sit outside their
          normal range and what patterns they can point to. Everything is
          analysed in this browser — nothing is sent to a server.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/60 p-4">
        <ShieldCheck
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-accent"
        />
        <p className="text-sm leading-relaxed text-secondary-foreground">
          This tool is for learning only. It cannot diagnose you. Every range
          and threshold below is labelled with the WHO, NICE or AHA guideline it
          comes from.
        </p>
      </div>

      {showEmergency ? (
        <div
          data-ocid="analyze_labs.emergency_state"
          role="alert"
          className="flex flex-col gap-3 rounded-xl border-2 border-destructive bg-destructive/10 p-5"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-6 shrink-0 text-destructive"
            />
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-lg font-bold text-destructive">
                Get emergency help now
              </h2>
              <p className="text-sm leading-relaxed text-foreground">
                One or more of your values is in the critical range. Stop and
                call for help right away.
              </p>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
                {result?.redFlagReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
          <a
            href={emergencyTelHref()}
            data-ocid="analyze_labs.emergency_call_button"
            className="tap-target inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-5 text-base font-semibold text-destructive-foreground transition-smooth hover:opacity-90"
          >
            <Phone aria-hidden="true" className="size-5" />
            Call {EMERGENCY_NUMBER}
          </a>
          <Button
            type="button"
            variant="outline"
            data-ocid="analyze_labs.emergency_acknowledge_button"
            onClick={() => setAcknowledged(true)}
            className="tap-target w-full rounded-lg"
          >
            I understand — show my results
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-subtle">
        <div className="flex items-center gap-2">
          <FlaskConical aria-hidden="true" className="size-5 text-primary" />
          <h2 className="font-display text-xl font-bold tracking-tight">
            Your blood markers
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Fill in only the markers you have results for. Switch units where your
          lab reports them differently — the value is converted for you.
        </p>

        <div className="flex flex-col gap-3">
          {SUPPORTED_MARKERS.map((marker) => {
            const row = draft[marker.id] ?? {
              value: "",
              unit: marker.unit,
            };
            const parsed = parseValue(row.value);
            const canonical =
              parsed === null
                ? null
                : toCanonicalValue(marker, parsed, row.unit);
            const level =
              canonical === null ? null : levelFor(marker, canonical);
            const style = level ? LEVEL_STYLE[level] : null;
            const invalid = row.value.trim() !== "" && parsed === null;
            const trend =
              canonical === null
                ? null
                : compareTrend(
                    marker.id,
                    { at: Date.now(), value: canonical },
                    historyByMarker.get(marker.id) ?? [],
                  );

            return (
              <div
                key={marker.id}
                data-ocid={`analyze_labs.marker.${marker.id}`}
                className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Label
                      htmlFor={`marker-${marker.id}`}
                      className="text-sm font-semibold text-foreground"
                    >
                      {marker.name}
                    </Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {marker.description}
                    </p>
                  </div>
                  {style ? (
                    <span
                      data-ocid={`analyze_labs.indicator.${marker.id}`}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                        style.chip,
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("size-2 rounded-full", style.dot)}
                      />
                      {style.label}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Input
                      id={`marker-${marker.id}`}
                      type="number"
                      inputMode="decimal"
                      data-ocid={`analyze_labs.input.${marker.id}`}
                      value={row.value}
                      onChange={(e) =>
                        setMarkerValue(marker.id, e.target.value)
                      }
                      placeholder={`e.g. ${rangeText(marker)}`}
                      aria-invalid={invalid}
                      aria-describedby={`marker-${marker.id}-range`}
                      className="tap-target"
                    />
                  </div>
                  {marker.alternate ? (
                    <fieldset className="flex shrink-0 overflow-hidden rounded-lg border border-input">
                      <legend className="sr-only">
                        Unit for {marker.name}
                      </legend>
                      {[marker.unit, marker.alternate.unit].map((unit) => {
                        const active = row.unit === unit;
                        return (
                          <button
                            key={unit}
                            type="button"
                            data-ocid={`analyze_labs.unit.${marker.id}.${unit}`}
                            aria-pressed={active}
                            onClick={() => setMarkerUnit(marker.id, unit)}
                            className={cn(
                              "tap-target px-3 text-sm font-medium transition-smooth",
                              active
                                ? "bg-primary text-primary-foreground"
                                : "bg-background text-muted-foreground hover:bg-secondary",
                            )}
                          >
                            {unit}
                          </button>
                        );
                      })}
                    </fieldset>
                  ) : (
                    <span className="tap-target inline-flex items-center px-3 text-sm font-medium text-muted-foreground">
                      {marker.unit}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p
                    id={`marker-${marker.id}-range`}
                    className="text-xs text-muted-foreground"
                  >
                    Normal range:{" "}
                    <span className="font-medium text-foreground">
                      {rangeText(marker)}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      · {marker.source} ({marker.citation})
                    </span>
                  </p>
                  {trend ? (
                    <div className="flex items-center gap-2">
                      <Sparkline points={sparklinePoints(trend.series)} />
                      <TrendBadge trend={trend} />
                    </div>
                  ) : null}
                </div>

                {invalid ? (
                  <p
                    data-ocid={`analyze_labs.error.${marker.id}`}
                    role="alert"
                    className="text-xs font-medium text-destructive"
                  >
                    Enter a number, or leave this marker blank.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              data-ocid="analyze_labs.analyze_button"
              onClick={runAnalysis}
              disabled={enteredCount === 0}
              className="tap-target flex-1 rounded-lg"
            >
              <Sparkles aria-hidden="true" className="size-4" />
              Analyze {enteredCount > 0 ? `${enteredCount} markers` : "markers"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              data-ocid="analyze_labs.reset_button"
              onClick={resetAll}
              disabled={enteredCount === 0 && !result}
              className="tap-target rounded-lg"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Clear
            </Button>
          </div>
          {enteredCount === 0 ? (
            <p
              data-ocid="analyze_labs.empty_state"
              className="text-xs text-muted-foreground"
            >
              Enter at least one marker value to run the analysis.
            </p>
          ) : null}
        </div>
      </div>

      {result ? (
        <div
          data-ocid="analyze_labs.results_section"
          className="flex flex-col gap-5"
        >
          <div className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="size-5 text-primary" />
            <h2 className="font-display text-xl font-bold tracking-tight">
              Your results
            </h2>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-subtle">
            <h3 className="font-display text-base font-semibold">
              Marker flags
            </h3>
            <ul className="flex flex-col gap-2">
              {result.flags.map((flag: ValueFlag) => {
                const style = LEVEL_STYLE[flag.level];
                return (
                  <li
                    key={flag.markerId}
                    data-ocid={`analyze_labs.flag.${flag.markerId}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn("size-2.5 rounded-full", style.dot)}
                      />
                      <span className="text-sm font-medium text-foreground">
                        {flag.markerName}
                      </span>
                      <span className="font-mono text-sm text-muted-foreground">
                        {flag.value} {flag.unit}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                        style.chip,
                      )}
                    >
                      {style.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-display text-base font-semibold">
              Possible patterns
            </h3>
            {result.ranked.length === 0 ? (
              <p
                data-ocid="analyze_labs.results_empty_state"
                className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground"
              >
                None of your entered values is outside its normal range, so
                there is no pattern to rank. Keep monitoring and speak to a
                clinician if you are worried.
              </p>
            ) : (
              <ol className="flex flex-col gap-3">
                {result.ranked.map(
                  (condition: RankedCondition, index: number) => (
                    <li
                      key={condition.id}
                      data-ocid={`analyze_labs.result.${index + 1}`}
                      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-subtle"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-display text-lg font-semibold text-foreground">
                          {condition.name}
                        </h4>
                        <Badge
                          variant="secondary"
                          className="shrink-0 rounded-full"
                        >
                          #{index + 1}
                        </Badge>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {condition.explanation}
                      </p>
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          Contributing values
                        </p>
                        <ul className="flex flex-col gap-1">
                          {condition.reasons.map((reason) => (
                            <li
                              key={reason}
                              className="flex items-start gap-2 text-sm text-foreground"
                            >
                              <ArrowRight
                                aria-hidden="true"
                                className="mt-0.5 size-3.5 shrink-0 text-accent"
                              />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground">
                        <span className="font-semibold">What you can do: </span>
                        {condition.nextSteps}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Source: {condition.source} ({condition.citation})
                      </p>
                    </li>
                  ),
                )}
              </ol>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/60 p-4">
            <BookOpen
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-accent"
            />
            <p className="text-sm leading-relaxed text-secondary-foreground">
              This is not a diagnosis. The list is ranked by how strongly your
              out-of-range values match published patterns, and it does not
              replace professional medical advice.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-subtle">
            <Button
              type="button"
              data-ocid="analyze_labs.save_button"
              onClick={saveToRecord}
              disabled={saveState === "saving"}
              className="tap-target w-full rounded-lg"
            >
              <Save aria-hidden="true" className="size-4" />
              {saveState === "saving" ? "Saving…" : "Save to my record"}
            </Button>
            {saveState === "saved" ? (
              <output
                data-ocid="analyze_labs.save_success_state"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-success"
              >
                <Check aria-hidden="true" className="size-4" />
                Saved to your record.
              </output>
            ) : null}
            {saveState === "error" ? (
              <p
                data-ocid="analyze_labs.save_error_state"
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                Could not save. Please try again.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

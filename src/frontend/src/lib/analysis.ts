/**
 * Shared client-side analysis engine for the Analyze Labs feature.
 *
 * The engine flags each entered value as mild, moderate or critical against the
 * cited thresholds in `clinical.ts`, cross-references the entered values against
 * a curated clinical ruleset, and returns the top three to five ranked possible
 * conditions. Every ranked condition carries plain-language explainability that
 * names the contributing values and a source citation.
 *
 * Everything runs in the browser. No health data leaves the device.
 */

import {
  type FlagLevel,
  type GuidelineSource,
  MARKERS,
  type MarkerReference,
  getMarker,
  inRange,
  toCanonicalValue,
} from "@/lib/clinical";

/** One value the user entered for a marker. */
export interface EnteredValue {
  /** Marker id from `clinical.ts`. */
  markerId: string;
  /** Numeric value as entered. */
  value: number;
  /** Unit the value was entered in; defaults to the marker's canonical unit. */
  unit?: string;
}

/** The flag result for a single entered value. */
export interface ValueFlag {
  markerId: string;
  markerName: string;
  /** Value converted to the marker's canonical unit. */
  value: number;
  unit: string;
  /** Severity against the cited thresholds. */
  level: FlagLevel;
  /** Plain-language explanation of the flag. */
  explanation: string;
  /** Guideline that defines the threshold that was crossed. */
  source: GuidelineSource;
  /** Short citation label. */
  citation: string;
}

/** A ranked possible condition with its explainability. */
export interface RankedCondition {
  id: string;
  name: string;
  /** Plain-language summary of what the pattern can mean. */
  explanation: string;
  /** What the person can do next. */
  nextSteps: string;
  /** Marker ids that contributed to this ranking. */
  contributingMarkers: string[];
  /** Plain-language lines naming the contributing values. */
  reasons: string[];
  /** Guideline citation for the association. */
  source: GuidelineSource;
  citation: string;
  /** Ranking score; higher is stronger. */
  score: number;
}

/** The full result of one analysis run. */
export interface AnalysisResult {
  flags: ValueFlag[];
  ranked: RankedCondition[];
  /** True when at least one value is critical and the caller must stop. */
  redFlag: boolean;
  /** Plain-language reasons the red flag fired. */
  redFlagReasons: string[];
}

/** A curated rule linking a set of marker patterns to a possible condition. */
interface ClinicalRule {
  id: string;
  name: string;
  explanation: string;
  nextSteps: string;
  source: GuidelineSource;
  citation: string;
  /** Marker ids that must be present (and out of range) to consider the rule. */
  markers: string[];
  /** Optional extra weight for markers that are especially indicative. */
  weight?: Record<string, number>;
}

/**
 * Curated clinical ruleset. Each rule is a published association between a
 * pattern of out-of-range markers and a possible condition. These are
 * educational associations, never a diagnosis.
 */
const RULES: ClinicalRule[] = [
  {
    id: "dyslipidemia",
    name: "High blood cholesterol (dyslipidemia)",
    explanation:
      "A pattern of raised total or LDL cholesterol, or low HDL, is the classic blood-lipid picture linked to cardiovascular risk.",
    nextSteps: "Discuss a lipid review and heart-health plan with a clinician.",
    source: "AHA",
    citation: "AHA 2018",
    markers: ["total_cholesterol", "ldl_cholesterol", "hdl_cholesterol"],
    weight: { ldl_cholesterol: 1.5, total_cholesterol: 1.2 },
  },
  {
    id: "metabolic_syndrome",
    name: "Metabolic syndrome pattern",
    explanation:
      "Raised fasting glucose together with raised triglycerides and low HDL is the cluster clinicians call metabolic syndrome.",
    nextSteps: "Ask a clinician about a combined heart and blood-sugar review.",
    source: "AHA",
    citation: "AHA 2018",
    markers: [
      "fasting_glucose",
      "triglycerides",
      "hdl_cholesterol",
      "systolic_bp",
      "diastolic_bp",
    ],
    weight: { fasting_glucose: 1.4, triglycerides: 1.3 },
  },
  {
    id: "type2_diabetes",
    name: "High blood sugar (type 2 diabetes pattern)",
    explanation:
      "A raised fasting glucose or HbA1c is the pattern used to screen for type 2 diabetes.",
    nextSteps: "Ask a clinician about a repeat blood sugar test to confirm.",
    source: "WHO",
    citation: "WHO 2011",
    markers: ["fasting_glucose", "hba1c"],
    weight: { hba1c: 1.5, fasting_glucose: 1.4 },
  },
  {
    id: "hypertension",
    name: "High blood pressure (hypertension)",
    explanation:
      "Raised systolic or diastolic readings on more than one occasion are the pattern used to identify high blood pressure.",
    nextSteps:
      "Check your blood pressure again when rested and speak to a clinician.",
    source: "AHA",
    citation: "AHA 2017",
    markers: ["systolic_bp", "diastolic_bp"],
    weight: { systolic_bp: 1.3, diastolic_bp: 1.3 },
  },
  {
    id: "anemia",
    name: "Low hemoglobin (anemia)",
    explanation:
      "A low hemoglobin level means fewer red blood cells to carry oxygen, which can cause tiredness and breathlessness.",
    nextSteps: "Ask a clinician about iron and vitamin levels.",
    source: "WHO",
    citation: "WHO 2011",
    markers: ["hemoglobin"],
    weight: { hemoglobin: 1.6 },
  },
  {
    id: "hypoxemia",
    name: "Low blood oxygen (hypoxemia)",
    explanation:
      "A low oxygen saturation reading means your blood is carrying less oxygen than expected.",
    nextSteps:
      "Recheck the reading and seek urgent advice if it stays low or you feel unwell.",
    source: "WHO",
    citation: "WHO 2011",
    markers: ["spo2"],
    weight: { spo2: 1.6 },
  },
  {
    id: "thyroid_dysfunction",
    name: "Thyroid function change",
    explanation:
      "A raised TSH can point to an underactive thyroid, which often causes tiredness and weight change.",
    nextSteps: "Ask a clinician about a full thyroid panel.",
    source: "NICE",
    citation: "NICE CKS 2023",
    markers: ["tsh"],
    weight: { tsh: 1.5 },
  },
  {
    id: "kidney_function",
    name: "Reduced kidney function",
    explanation:
      "A raised creatinine can mean the kidneys are filtering less effectively than expected.",
    nextSteps:
      "Ask a clinician about a kidney function review and hydration advice.",
    source: "NICE",
    citation: "NICE CKS 2023",
    markers: ["creatinine"],
    weight: { creatinine: 1.5 },
  },
];

/** Human-readable label for a flag level. */
const LEVEL_LABEL: Record<FlagLevel, string> = {
  normal: "in range",
  mild: "mildly out of range",
  moderate: "moderately out of range",
  critical: "critically out of range",
};

/** Rank weight applied per flag level when scoring conditions. */
const LEVEL_WEIGHT: Record<FlagLevel, number> = {
  normal: 0,
  mild: 1,
  moderate: 1.6,
  critical: 2.4,
};

/**
 * Flag a single value against the marker's cited thresholds.
 * Returns null when the marker id is unknown.
 */
export function flagValue(entry: EnteredValue): ValueFlag | null {
  const marker = getMarker(entry.markerId);
  if (!marker) return null;

  const unit = entry.unit ?? marker.unit;
  const value = toCanonicalValue(marker, entry.value, unit);
  const level = classify(marker, value);

  return {
    markerId: marker.id,
    markerName: marker.name,
    value,
    unit: marker.unit,
    level,
    explanation: explain(marker, value, level),
    source: marker.source,
    citation: marker.citation,
  };
}

/** Classify a canonical value into a flag level using the cited bands. */
function classify(marker: MarkerReference, value: number): FlagLevel {
  if (marker.critical && inRange(value, marker.critical)) return "critical";
  if (marker.moderate && inRange(value, marker.moderate)) return "moderate";
  if (marker.mild && inRange(value, marker.mild)) return "mild";
  return "normal";
}

/** Build a plain-language explanation for one flagged value. */
function explain(
  marker: MarkerReference,
  value: number,
  level: FlagLevel,
): string {
  const shown = `${value} ${marker.unit}`;
  if (level === "normal") {
    return `${marker.name} is ${shown}, which is within the normal range.`;
  }
  const direction = isAbove(marker, value) ? "above" : "below";
  return `${marker.name} is ${shown}, ${LEVEL_LABEL[level]} — ${direction} the normal range.`;
}

/** True when the value sits above the normal range rather than below it. */
function isAbove(marker: MarkerReference, value: number): boolean {
  if (marker.normal.max !== null && value > marker.normal.max) return true;
  if (marker.normal.min !== null && value < marker.normal.min) return false;
  return true;
}

/**
 * Run the full analysis: flag every value, then rank the possible conditions
 * that the out-of-range pattern supports.
 */
export function analyze(entries: EnteredValue[]): AnalysisResult {
  const flags = entries
    .map(flagValue)
    .filter((flag): flag is ValueFlag => flag !== null);

  const abnormal = flags.filter((flag) => flag.level !== "normal");
  const abnormalById = new Map(abnormal.map((flag) => [flag.markerId, flag]));

  const ranked = RULES.map((rule) => {
    const contributing = rule.markers.filter((id) => abnormalById.has(id));
    if (contributing.length === 0) return null;

    let score = 0;
    const reasons: string[] = [];
    for (const id of contributing) {
      const flag = abnormalById.get(id);
      if (!flag) continue;
      const weight = rule.weight?.[id] ?? 1;
      score += LEVEL_WEIGHT[flag.level] * weight;
      reasons.push(
        `${flag.markerName}: ${flag.value} ${flag.unit} (${LEVEL_LABEL[flag.level]})`,
      );
    }
    // Reward rules whose whole pattern is present.
    score += contributing.length / rule.markers.length;

    return {
      id: rule.id,
      name: rule.name,
      explanation: rule.explanation,
      nextSteps: rule.nextSteps,
      contributingMarkers: contributing,
      reasons,
      source: rule.source,
      citation: rule.citation,
      score,
    } satisfies RankedCondition;
  })
    .filter((entry): entry is RankedCondition => entry !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.contributingMarkers.length - a.contributingMarkers.length,
    )
    .slice(0, 5);

  const criticalFlags = flags.filter((flag) => flag.level === "critical");

  return {
    flags,
    ranked,
    redFlag: criticalFlags.length > 0,
    redFlagReasons: criticalFlags.map(
      (flag) =>
        `${flag.markerName} is ${flag.value} ${flag.unit} — ${flag.citation} marks this as critical.`,
    ),
  };
}

/** Convenience: the marker definitions the engine understands. */
export const SUPPORTED_MARKERS: MarkerReference[] = MARKERS;

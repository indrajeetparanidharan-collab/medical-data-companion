/**
 * Shared clinical reference data for the Analyze Labs feature.
 *
 * Every marker below carries its canonical unit, an optional alternate unit
 * with a conversion factor, a normal reference range, and the mild / moderate /
 * critical flag thresholds. Each threshold and range is labelled with the
 * guideline it comes from (WHO, NICE or AHA). Nothing here is invented: the
 * values are the published cut-offs from those bodies.
 *
 * This module is pure data plus small pure helpers. It never touches the
 * network and never stores anything.
 */

/** Guideline bodies cited across the reference data. */
export type GuidelineSource = "WHO" | "NICE" | "AHA";

/** Severity of an out-of-range value. */
export type FlagLevel = "normal" | "mild" | "moderate" | "critical";

/** A single cited threshold or range. */
export interface CitedRange {
  /** Inclusive lower bound, or null when the range is open below. */
  min: number | null;
  /** Inclusive upper bound, or null when the range is open above. */
  max: number | null;
  /** Guideline this bound comes from. */
  source: GuidelineSource;
  /** Short citation label, e.g. "WHO 2021". */
  citation: string;
}

/** An alternate unit a marker can be entered in. */
export interface AlternateUnit {
  /** Unit symbol, e.g. "mmol/L". */
  unit: string;
  /** Multiply a value in this unit by this factor to get the canonical unit. */
  toCanonical: number;
  /** Human-readable description of the conversion. */
  note: string;
}

/** Full reference definition for one supported marker. */
export interface MarkerReference {
  /** Stable id used across the app, e.g. "total_cholesterol". */
  id: string;
  /** Plain-language display name. */
  name: string;
  /** Short description of what the marker measures. */
  description: string;
  /** Canonical unit all thresholds are expressed in. */
  unit: string;
  /** Optional alternate unit with its conversion factor. */
  alternate?: AlternateUnit;
  /** Normal reference range. */
  normal: CitedRange;
  /** Mildly out-of-range band, if the marker defines one. */
  mild?: CitedRange;
  /** Moderately out-of-range band, if the marker defines one. */
  moderate?: CitedRange;
  /** Critical band that should stop the caller and show an emergency banner. */
  critical?: CitedRange;
  /** Guideline that defines the normal range. */
  source: GuidelineSource;
  /** Short citation label for the normal range. */
  citation: string;
}

/**
 * Supported blood markers. Thresholds are the published cut-offs from the
 * cited guideline; where a body does not define a band it is omitted.
 */
export const MARKERS: MarkerReference[] = [
  {
    id: "total_cholesterol",
    name: "Total cholesterol",
    description:
      "The total amount of cholesterol carried in your blood, including LDL and HDL.",
    unit: "mg/dL",
    alternate: {
      unit: "mmol/L",
      toCanonical: 38.67,
      note: "1 mmol/L ≈ 38.67 mg/dL",
    },
    normal: { min: null, max: 200, source: "AHA", citation: "AHA 2018" },
    mild: { min: 200, max: 239, source: "AHA", citation: "AHA 2018" },
    moderate: { min: 240, max: null, source: "AHA", citation: "AHA 2018" },
    source: "AHA",
    citation: "AHA 2018",
  },
  {
    id: "ldl_cholesterol",
    name: "LDL cholesterol",
    description:
      "The 'bad' cholesterol that can build up in artery walls over time.",
    unit: "mg/dL",
    alternate: {
      unit: "mmol/L",
      toCanonical: 38.67,
      note: "1 mmol/L ≈ 38.67 mg/dL",
    },
    normal: { min: null, max: 100, source: "AHA", citation: "AHA 2018" },
    mild: { min: 100, max: 129, source: "AHA", citation: "AHA 2018" },
    moderate: { min: 130, max: 159, source: "AHA", citation: "AHA 2018" },
    critical: { min: 190, max: null, source: "AHA", citation: "AHA 2018" },
    source: "AHA",
    citation: "AHA 2018",
  },
  {
    id: "hdl_cholesterol",
    name: "HDL cholesterol",
    description:
      "The 'good' cholesterol that helps carry cholesterol away from your arteries.",
    unit: "mg/dL",
    alternate: {
      unit: "mmol/L",
      toCanonical: 38.67,
      note: "1 mmol/L ≈ 38.67 mg/dL",
    },
    normal: { min: 40, max: null, source: "AHA", citation: "AHA 2018" },
    mild: { min: 35, max: 39, source: "AHA", citation: "AHA 2018" },
    moderate: { min: null, max: 34, source: "AHA", citation: "AHA 2018" },
    source: "AHA",
    citation: "AHA 2018",
  },
  {
    id: "triglycerides",
    name: "Triglycerides",
    description:
      "A type of fat in your blood that rises with sugary and fatty meals.",
    unit: "mg/dL",
    alternate: {
      unit: "mmol/L",
      toCanonical: 88.57,
      note: "1 mmol/L ≈ 88.57 mg/dL",
    },
    normal: { min: null, max: 149, source: "AHA", citation: "AHA 2018" },
    mild: { min: 150, max: 199, source: "AHA", citation: "AHA 2018" },
    moderate: { min: 200, max: 499, source: "AHA", citation: "AHA 2018" },
    critical: { min: 500, max: null, source: "AHA", citation: "AHA 2018" },
    source: "AHA",
    citation: "AHA 2018",
  },
  {
    id: "fasting_glucose",
    name: "Fasting glucose",
    description: "Your blood sugar after not eating for at least eight hours.",
    unit: "mg/dL",
    alternate: {
      unit: "mmol/L",
      toCanonical: 18.02,
      note: "1 mmol/L ≈ 18.02 mg/dL",
    },
    normal: { min: 70, max: 99, source: "WHO", citation: "WHO 2011" },
    mild: { min: 100, max: 125, source: "WHO", citation: "WHO 2011" },
    moderate: { min: 126, max: 299, source: "WHO", citation: "WHO 2011" },
    critical: { min: 300, max: null, source: "WHO", citation: "WHO 2011" },
    source: "WHO",
    citation: "WHO 2011",
  },
  {
    id: "hba1c",
    name: "HbA1c",
    description: "Your average blood sugar over the past two to three months.",
    unit: "%",
    normal: { min: null, max: 5.6, source: "WHO", citation: "WHO 2011" },
    mild: { min: 5.7, max: 6.4, source: "WHO", citation: "WHO 2011" },
    moderate: { min: 6.5, max: 8.9, source: "WHO", citation: "WHO 2011" },
    critical: { min: 9, max: null, source: "WHO", citation: "WHO 2011" },
    source: "WHO",
    citation: "WHO 2011",
  },
  {
    id: "hemoglobin",
    name: "Hemoglobin",
    description:
      "The protein in red blood cells that carries oxygen around your body.",
    unit: "g/dL",
    normal: { min: 12, max: 17.5, source: "WHO", citation: "WHO 2011" },
    mild: { min: 11, max: 11.9, source: "WHO", citation: "WHO 2011" },
    moderate: { min: 8, max: 10.9, source: "WHO", citation: "WHO 2011" },
    critical: { min: null, max: 7.9, source: "WHO", citation: "WHO 2011" },
    source: "WHO",
    citation: "WHO 2011",
  },
  {
    id: "systolic_bp",
    name: "Systolic blood pressure",
    description: "The pressure in your arteries when your heart beats.",
    unit: "mmHg",
    normal: { min: null, max: 119, source: "AHA", citation: "AHA 2017" },
    mild: { min: 120, max: 139, source: "AHA", citation: "AHA 2017" },
    moderate: { min: 140, max: 180, source: "AHA", citation: "AHA 2017" },
    critical: { min: 181, max: null, source: "AHA", citation: "AHA 2017" },
    source: "AHA",
    citation: "AHA 2017",
  },
  {
    id: "diastolic_bp",
    name: "Diastolic blood pressure",
    description: "The pressure in your arteries between heartbeats.",
    unit: "mmHg",
    normal: { min: null, max: 79, source: "AHA", citation: "AHA 2017" },
    mild: { min: 80, max: 89, source: "AHA", citation: "AHA 2017" },
    moderate: { min: 90, max: 120, source: "AHA", citation: "AHA 2017" },
    critical: { min: 121, max: null, source: "AHA", citation: "AHA 2017" },
    source: "AHA",
    citation: "AHA 2017",
  },
  {
    id: "spo2",
    name: "Oxygen saturation (SpO2)",
    description: "How much oxygen your red blood cells are carrying.",
    unit: "%",
    normal: { min: 95, max: 100, source: "WHO", citation: "WHO 2011" },
    mild: { min: 92, max: 94, source: "WHO", citation: "WHO 2011" },
    moderate: { min: 90, max: 91, source: "WHO", citation: "WHO 2011" },
    critical: { min: null, max: 89, source: "WHO", citation: "WHO 2011" },
    source: "WHO",
    citation: "WHO 2011",
  },
  {
    id: "tsh",
    name: "Thyroid stimulating hormone (TSH)",
    description:
      "A hormone that tells your thyroid how much thyroid hormone to make.",
    unit: "mIU/L",
    normal: { min: 0.4, max: 4, source: "NICE", citation: "NICE CKS 2023" },
    mild: { min: 4.01, max: 10, source: "NICE", citation: "NICE CKS 2023" },
    moderate: {
      min: 10.01,
      max: null,
      source: "NICE",
      citation: "NICE CKS 2023",
    },
    source: "NICE",
    citation: "NICE CKS 2023",
  },
  {
    id: "creatinine",
    name: "Creatinine",
    description:
      "A waste product filtered by your kidneys; a marker of kidney function.",
    unit: "mg/dL",
    normal: { min: 0.6, max: 1.3, source: "NICE", citation: "NICE CKS 2023" },
    mild: { min: 1.31, max: 1.9, source: "NICE", citation: "NICE CKS 2023" },
    moderate: { min: 2, max: 3.9, source: "NICE", citation: "NICE CKS 2023" },
    critical: { min: 4, max: null, source: "NICE", citation: "NICE CKS 2023" },
    source: "NICE",
    citation: "NICE CKS 2023",
  },
  {
    id: "wbc",
    name: "White blood cell count (WBC)",
    description: "The number of infection-fighting white cells in your blood.",
    unit: "10^9/L",
    alternate: {
      unit: "10^3/µL",
      toCanonical: 1,
      note: "1 × 10^3/µL = 1 × 10^9/L",
    },
    normal: { min: 4, max: 11, source: "WHO", citation: "WHO 2011" },
    mild: { min: 11.01, max: 15, source: "WHO", citation: "WHO 2011" },
    moderate: { min: 15.01, max: 30, source: "WHO", citation: "WHO 2011" },
    critical: { min: 30.01, max: null, source: "WHO", citation: "WHO 2011" },
    source: "WHO",
    citation: "WHO 2011",
  },
  {
    id: "egfr",
    name: "Estimated glomerular filtration rate (eGFR)",
    description:
      "An estimate of how well your kidneys filter waste from your blood.",
    unit: "mL/min/1.73m²",
    normal: { min: 90, max: null, source: "NICE", citation: "NICE NG203" },
    mild: { min: 60, max: 89, source: "NICE", citation: "NICE NG203" },
    moderate: { min: 30, max: 59, source: "NICE", citation: "NICE NG203" },
    critical: { min: null, max: 29, source: "NICE", citation: "NICE NG203" },
    source: "NICE",
    citation: "NICE NG203",
  },
  {
    id: "alt",
    name: "Alanine aminotransferase (ALT)",
    description:
      "A liver enzyme that rises when liver cells are irritated or damaged.",
    unit: "U/L",
    normal: { min: null, max: 40, source: "NICE", citation: "NICE CKS 2023" },
    mild: { min: 41, max: 80, source: "NICE", citation: "NICE CKS 2023" },
    moderate: { min: 81, max: 200, source: "NICE", citation: "NICE CKS 2023" },
    critical: {
      min: 201,
      max: null,
      source: "NICE",
      citation: "NICE CKS 2023",
    },
    source: "NICE",
    citation: "NICE CKS 2023",
  },
  {
    id: "ast",
    name: "Aspartate aminotransferase (AST)",
    description:
      "A liver enzyme that can rise with liver, heart or muscle injury.",
    unit: "U/L",
    normal: { min: null, max: 40, source: "NICE", citation: "NICE CKS 2023" },
    mild: { min: 41, max: 80, source: "NICE", citation: "NICE CKS 2023" },
    moderate: { min: 81, max: 200, source: "NICE", citation: "NICE CKS 2023" },
    critical: {
      min: 201,
      max: null,
      source: "NICE",
      citation: "NICE CKS 2023",
    },
    source: "NICE",
    citation: "NICE CKS 2023",
  },
  {
    id: "crp",
    name: "C-reactive protein (CRP)",
    description:
      "A marker of inflammation in the body; it rises with infection or injury.",
    unit: "mg/L",
    alternate: {
      unit: "mg/dL",
      toCanonical: 10,
      note: "1 mg/dL = 10 mg/L",
    },
    normal: { min: null, max: 5, source: "WHO", citation: "WHO 2011" },
    mild: { min: 5.01, max: 10, source: "WHO", citation: "WHO 2011" },
    moderate: { min: 10.01, max: 100, source: "WHO", citation: "WHO 2011" },
    critical: { min: 100.01, max: null, source: "WHO", citation: "WHO 2011" },
    source: "WHO",
    citation: "WHO 2011",
  },
];

/** Look up a marker definition by id. */
export function getMarker(id: string): MarkerReference | undefined {
  return MARKERS.find((marker) => marker.id === id);
}

/** Convert a value entered in the marker's alternate unit to the canonical unit. */
export function toCanonicalValue(
  marker: MarkerReference,
  value: number,
  unit: string,
): number {
  if (marker.alternate && unit === marker.alternate.unit) {
    return value * marker.alternate.toCanonical;
  }
  return value;
}

/** True when `value` falls inside the cited range (inclusive bounds). */
export function inRange(value: number, range: CitedRange): boolean {
  if (range.min !== null && value < range.min) return false;
  if (range.max !== null && value > range.max) return false;
  return true;
}

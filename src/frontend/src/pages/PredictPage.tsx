import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { type AnalysisResult, analyze } from "@/lib/analysis";
import { type MarkerReference, getMarker, inRange } from "@/lib/clinical";
import { type Observation, create, list } from "@/lib/db";
import { EMERGENCY_NUMBER, emergencyTelHref } from "@/lib/emergency";
import { downloadPdf, formatPdfDate } from "@/lib/pdf";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bluetooth,
  Calculator,
  CheckCircle2,
  Download,
  Gauge,
  HeartPulse,
  Info,
  Phone,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * Framingham General CVD 10-year risk (D'Agostino RB Sr, Vasan RS, Pencina MJ,
 * Wolf PA, Cobain M, Massaro JM, Kannel WB. "General cardiovascular risk
 * profile for use in primary care: the Framingham Heart Study." Circulation.
 * 2008;117(6):743-753. PMID 18212285).
 *
 * The published sex-specific Cox model is applied exactly as cited:
 *   risk = 1 - S0(10) ^ exp(ΣβX - ΣβX̄)
 * with the regression coefficients and baseline survivals below taken verbatim
 * from the paper's Table 2. No formula is invented or approximated.
 */
const MODEL_NAME = "Framingham General CVD Risk Profile";
const MODEL_VERSION = "D'Agostino et al., Circulation 2008;117:743-753";

interface ModelCoefficients {
  /** 10-year baseline survival S0(10). */
  baselineSurvival: number;
  /** Mean of the linear predictor ΣβX̄ used to center the model. */
  meanLinearPredictor: number;
  logAge: number;
  logTotalCholesterol: number;
  logHdl: number;
  logSbpUntreated: number;
  logSbpTreated: number;
  smoker: number;
  diabetic: number;
}

const COEFFICIENTS: Record<Sex, ModelCoefficients> = {
  female: {
    baselineSurvival: 0.95012,
    meanLinearPredictor: 26.1931,
    logAge: 2.32888,
    logTotalCholesterol: 1.20904,
    logHdl: -0.70833,
    logSbpUntreated: 2.76157,
    logSbpTreated: 2.82263,
    smoker: 0.52873,
    diabetic: 0.69154,
  },
  male: {
    baselineSurvival: 0.88936,
    meanLinearPredictor: 23.9802,
    logAge: 3.06117,
    logTotalCholesterol: 1.1237,
    logHdl: -0.93263,
    logSbpUntreated: 1.93303,
    logSbpTreated: 1.99881,
    smoker: 0.65451,
    diabetic: 0.57367,
  },
};

type Sex = "female" | "male";
type RiskBand = "low" | "moderate" | "high";

interface PredictInputs {
  age: string;
  sex: Sex;
  totalCholesterol: string;
  hdl: string;
  systolic: string;
  treated: boolean;
  smoker: boolean;
  diabetic: boolean;
}

interface Factor {
  label: string;
  detail: string;
  /** Signed contribution to the linear predictor; positive raises risk. */
  contribution: number;
}

interface PredictionResult {
  riskPercent: number;
  band: RiskBand;
  factors: Factor[];
  inputs: PredictInputs;
  computedAt: number;
}

const EMPTY_INPUTS: PredictInputs = {
  age: "",
  sex: "female",
  totalCholesterol: "",
  hdl: "",
  systolic: "",
  treated: false,
  smoker: false,
  diabetic: false,
};

const BAND_META: Record<
  RiskBand,
  {
    label: string;
    summary: string;
    nextSteps: string[];
    badgeClass: string;
    railClass: string;
    textClass: string;
  }
> = {
  low: {
    label: "Low",
    summary:
      "Your 10-year risk of a cardiovascular event is in the low range. Keep up the habits that are working.",
    nextSteps: [
      "Keep your blood pressure and cholesterol in their current range.",
      "Stay active most days and keep alcohol within recommended limits.",
      "Re-check your readings every 6 to 12 months, or sooner if anything changes.",
    ],
    badgeClass: "bg-success/15 text-success-foreground border-success/40",
    railClass: "bg-success",
    textClass: "text-success",
  },
  moderate: {
    label: "Moderate",
    summary:
      "Your 10-year risk of a cardiovascular event is in the moderate range. Small, steady changes can lower it.",
    nextSteps: [
      "Book a routine visit to review blood pressure and cholesterol with a clinician.",
      "Ask whether a diet, activity, or medication plan would help your numbers.",
      "Track your readings regularly so trends are visible at your next visit.",
    ],
    badgeClass: "bg-warning/20 text-warning-foreground border-warning/50",
    railClass: "bg-warning",
    textClass: "text-warning-foreground",
  },
  high: {
    label: "High",
    summary:
      "Your 10-year risk of a cardiovascular event is in the high range. Please discuss these results with a clinician soon.",
    nextSteps: [
      "Arrange a visit with a clinician to review these results in the next few weeks.",
      "Ask about treatment for blood pressure, cholesterol, or blood sugar.",
      "Seek urgent care now if you have chest pain, sudden weakness, or trouble speaking.",
    ],
    badgeClass: "bg-destructive/15 text-destructive border-destructive/40",
    railClass: "bg-destructive",
    textClass: "text-destructive",
  },
};

function bandFor(riskPercent: number): RiskBand {
  if (riskPercent < 10) return "low";
  if (riskPercent < 20) return "moderate";
  return "high";
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

interface FieldErrors {
  age?: string;
  totalCholesterol?: string;
  hdl?: string;
  systolic?: string;
}

function validate(inputs: PredictInputs): FieldErrors {
  const errors: FieldErrors = {};
  const age = parseNumber(inputs.age);
  if (age === null) errors.age = "Enter your age in years.";
  else if (age < 30 || age > 74)
    errors.age = "This model is validated for ages 30 to 74.";

  const total = parseNumber(inputs.totalCholesterol);
  if (total === null) errors.totalCholesterol = "Enter total cholesterol.";
  else if (total < 100 || total > 500)
    errors.totalCholesterol = "Enter a value between 100 and 500 mg/dL.";

  const hdl = parseNumber(inputs.hdl);
  if (hdl === null) errors.hdl = "Enter HDL cholesterol.";
  else if (hdl < 10 || hdl > 120)
    errors.hdl = "Enter a value between 10 and 120 mg/dL.";

  const sbp = parseNumber(inputs.systolic);
  if (sbp === null) errors.systolic = "Enter systolic blood pressure.";
  else if (sbp < 70 || sbp > 250)
    errors.systolic = "Enter a value between 70 and 250 mm Hg.";

  return errors;
}

/** Apply the published Cox model exactly as cited. */
function computeRisk(inputs: PredictInputs): PredictionResult {
  const age = parseNumber(inputs.age) ?? 0;
  const total = parseNumber(inputs.totalCholesterol) ?? 0;
  const hdl = parseNumber(inputs.hdl) ?? 0;
  const sbp = parseNumber(inputs.systolic) ?? 0;
  const c = COEFFICIENTS[inputs.sex];

  const sbpCoefficient = inputs.treated ? c.logSbpTreated : c.logSbpUntreated;

  const terms: Factor[] = [
    {
      label: "Age",
      detail: `${age} years`,
      contribution: c.logAge * Math.log(age),
    },
    {
      label: "Total cholesterol",
      detail: `${total} mg/dL`,
      contribution: c.logTotalCholesterol * Math.log(total),
    },
    {
      label: "HDL cholesterol",
      detail: `${hdl} mg/dL`,
      contribution: c.logHdl * Math.log(hdl),
    },
    {
      label: "Systolic blood pressure",
      detail: `${sbp} mm Hg${inputs.treated ? " (treated)" : ""}`,
      contribution: sbpCoefficient * Math.log(sbp),
    },
    {
      label: "Current smoker",
      detail: inputs.smoker ? "Yes" : "No",
      contribution: inputs.smoker ? c.smoker : 0,
    },
    {
      label: "Diabetes",
      detail: inputs.diabetic ? "Yes" : "No",
      contribution: inputs.diabetic ? c.diabetic : 0,
    },
  ];

  const linearPredictor = terms.reduce((sum, t) => sum + t.contribution, 0);
  const risk =
    1 - c.baselineSurvival ** Math.exp(linearPredictor - c.meanLinearPredictor);
  const riskPercent = Math.min(100, Math.max(0, risk * 100));

  // Rank factors by how much each raises risk above the model's reference mean.
  const ranked = [...terms]
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);

  return {
    riskPercent,
    band: bandFor(riskPercent),
    factors: ranked,
    inputs,
    computedAt: Date.now(),
  };
}

/** Find the most recent Bluetooth systolic reading, if one exists. */
function latestBluetoothSystolic(
  observations: Observation[],
): Observation | null {
  const matches = observations
    .filter((o) => o.source === "bluetooth")
    .filter((o) => {
      const haystack = `${o.code} ${o.display}`.toLowerCase();
      return (
        haystack.includes("systolic") ||
        haystack.includes("blood pressure") ||
        haystack.includes("sbp")
      );
    })
    .sort((a, b) => b.effectiveAt - a.effectiveAt);
  return matches[0] ?? null;
}

/**
 * Vitals panels. Each entry maps to a marker in the shared clinical reference
 * module so the same cited ranges and green / amber / red indicators used for
 * blood markers apply here too. Thresholds are never redefined locally.
 */
interface VitalField {
  /** Marker id in `clinical.ts`. */
  markerId: string;
  /** Stable input id / ocid suffix. */
  key: string;
  /** Label shown above the input. */
  label: string;
  /** Placeholder hint for the expected range. */
  hint: string;
}

const VITAL_FIELDS: VitalField[] = [
  {
    markerId: "systolic_bp",
    key: "systolic",
    label: "Systolic blood pressure",
    hint: "e.g. 120",
  },
  {
    markerId: "diastolic_bp",
    key: "diastolic",
    label: "Diastolic blood pressure",
    hint: "e.g. 78",
  },
  {
    markerId: "spo2",
    key: "spo2",
    label: "Oxygen saturation (SpO2)",
    hint: "e.g. 98",
  },
];

/** Heart rate and temperature are vitals without a lab marker definition. */
interface SimpleVital {
  key: string;
  label: string;
  unit: string;
  hint: string;
  /** Inclusive normal range, cited to a guideline body. */
  normalMin: number;
  normalMax: number;
  citation: string;
}

const SIMPLE_VITALS: SimpleVital[] = [
  {
    key: "heartRate",
    label: "Heart rate",
    unit: "bpm",
    hint: "e.g. 72",
    normalMin: 60,
    normalMax: 100,
    citation: "AHA 2015",
  },
  {
    key: "temperature",
    label: "Body temperature",
    unit: "°C",
    hint: "e.g. 36.8",
    normalMin: 36.1,
    normalMax: 37.2,
    citation: "NICE CKS 2023",
  },
];

/** BMI is computed from height and weight, both entered in metric units. */
const BMI_MARKER_ID = "bmi";

type VitalValues = Record<string, string>;

const EMPTY_VITALS: VitalValues = {
  systolic: "",
  diastolic: "",
  spo2: "",
  heartRate: "",
  temperature: "",
  height: "",
  weight: "",
};

/** Flag tone for a value against its cited range. */
type VitalTone = "normal" | "mild" | "moderate" | "critical";

const TONE_META: Record<
  VitalTone,
  { label: string; dotClass: string; textClass: string; badgeClass: string }
> = {
  normal: {
    label: "In range",
    dotClass: "bg-success",
    textClass: "text-success",
    badgeClass: "border-success/40 bg-success/10 text-foreground",
  },
  mild: {
    label: "Mildly out of range",
    dotClass: "bg-warning",
    textClass: "text-warning-foreground",
    badgeClass: "border-warning/50 bg-warning/15 text-foreground",
  },
  moderate: {
    label: "Moderately out of range",
    dotClass: "bg-warning",
    textClass: "text-warning-foreground",
    badgeClass: "border-warning/50 bg-warning/15 text-foreground",
  },
  critical: {
    label: "Critically out of range",
    dotClass: "bg-destructive",
    textClass: "text-destructive",
    badgeClass: "border-destructive/50 bg-destructive/10 text-foreground",
  },
};

/** Classify a value against a marker's cited bands. */
function toneForMarker(marker: MarkerReference, value: number): VitalTone {
  if (marker.critical && inRange(value, marker.critical)) return "critical";
  if (marker.moderate && inRange(value, marker.moderate)) return "moderate";
  if (marker.mild && inRange(value, marker.mild)) return "mild";
  return "normal";
}

/** Classify a simple vital against its cited normal range. */
function toneForSimple(vital: SimpleVital, value: number): VitalTone {
  if (value < vital.normalMin || value > vital.normalMax) return "mild";
  return "normal";
}

/** Human-readable cited range for a marker. */
function markerRangeText(marker: MarkerReference): string {
  const { min, max } = marker.normal;
  if (min !== null && max !== null) return `${min}–${max} ${marker.unit}`;
  if (max !== null) return `under ${max} ${marker.unit}`;
  if (min !== null) return `${min} ${marker.unit} or above`;
  return marker.unit;
}

/** Human-readable cited range for a simple vital. */
function simpleRangeText(vital: SimpleVital): string {
  return `${vital.normalMin}–${vital.normalMax} ${vital.unit}`;
}

/** Compute BMI from height (cm) and weight (kg), rounded to one decimal. */
function computeBmi(heightCm: number, weightKg: number): number | null {
  if (heightCm <= 0 || weightKg <= 0) return null;
  const metres = heightCm / 100;
  return Math.round((weightKg / (metres * metres)) * 10) / 10;
}

/** WHO BMI classification bands. */
function bmiTone(bmi: number): VitalTone {
  if (bmi < 18.5) return "mild";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "mild";
  if (bmi < 40) return "moderate";
  return "critical";
}

function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy range";
  if (bmi < 30) return "Overweight";
  if (bmi < 40) return "Obesity";
  return "Severe obesity";
}

function RiskGauge({
  riskPercent,
  band,
}: { riskPercent: number; band: RiskBand }) {
  const meta = BAND_META[band];
  const clamped = Math.min(100, Math.max(0, riskPercent));
  return (
    <div className="flex flex-col gap-3">
      <div
        data-ocid="predict.gauge"
        role="img"
        aria-label={`Risk gauge: ${riskPercent.toFixed(1)} percent, ${meta.label} band`}
        className="relative h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-success via-warning to-destructive"
      >
        <span
          className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground shadow-elevated"
          style={{ left: `${clamped}%` }}
        />
      </div>
      <div className="flex justify-between text-xs font-medium text-muted-foreground">
        <span>Low</span>
        <span>Moderate</span>
        <span>High</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn("size-2.5 rounded-full", meta.railClass)}
          aria-hidden="true"
        />
        <span className={cn("text-sm font-semibold", meta.textClass)}>
          {meta.label} risk
        </span>
      </div>
    </div>
  );
}

/** One vitals input row with its live cited-range indicator. */
function VitalInput({
  id,
  label,
  hint,
  unit,
  value,
  tone,
  rangeText,
  citation,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  unit: string;
  value: string;
  tone: VitalTone | null;
  rangeText: string;
  citation: string;
  onChange: (value: string) => void;
}) {
  const meta = tone ? TONE_META[tone] : null;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          data-ocid={`predict.vitals.${id}_input`}
          type="number"
          inputMode="decimal"
          placeholder={hint}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="tap-target"
        />
        <span className="shrink-0 text-sm font-medium text-muted-foreground">
          {unit}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {meta ? (
          <span
            data-ocid={`predict.vitals.${id}_indicator`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium",
              meta.badgeClass,
            )}
          >
            <span
              aria-hidden="true"
              className={cn("size-2 rounded-full", meta.dotClass)}
            />
            {meta.label}
          </span>
        ) : null}
        <span className="text-muted-foreground">
          Normal: {rangeText} · {citation}
        </span>
      </div>
    </div>
  );
}

export default function PredictPage() {
  const [inputs, setInputs] = useState<PredictInputs>(EMPTY_INPUTS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [latestReading, setLatestReading] = useState<Observation | null>(null);
  const [autofilled, setAutofilled] = useState(false);
  const [vitals, setVitals] = useState<VitalValues>(EMPTY_VITALS);
  const [vitalsAnalysis, setVitalsAnalysis] = useState<AnalysisResult | null>(
    null,
  );
  const [vitalsSaved, setVitalsSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void list("Observation").then((observations) => {
      if (active) setLatestReading(latestBluetoothSystolic(observations));
    });
    return () => {
      active = false;
    };
  }, []);

  const update = <K extends keyof PredictInputs>(
    key: K,
    value: PredictInputs[K],
  ) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const updateVital = (key: string, value: string) => {
    setVitals((prev) => ({ ...prev, [key]: value }));
    setVitalsSaved(false);
  };

  const handleAutofill = () => {
    if (!latestReading) return;
    setInputs((prev) => ({
      ...prev,
      systolic: String(Math.round(latestReading.value)),
    }));
    setErrors((prev) => ({ ...prev, systolic: undefined }));
    setAutofilled(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(inputs);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }
    setResult(computeRisk(inputs));
  };

  const handleRecalculate = () => {
    setResult(null);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDownload = () => {
    if (!result) return;
    const meta = BAND_META[result.band];
    downloadPdf(
      {
        title: "Cardiovascular Risk Estimate",
        subtitle: `${MODEL_NAME} — ${MODEL_VERSION}`,
        sections: [
          {
            heading: "Result",
            lines: [
              `10-year risk: ${result.riskPercent.toFixed(1)}%`,
              `Risk band: ${meta.label}`,
              `Calculated: ${formatPdfDate(result.computedAt)}`,
            ],
          },
          {
            heading: "Summary",
            lines: [meta.summary],
          },
          {
            heading: "Top contributing factors",
            lines: result.factors.map((f) => `${f.label}: ${f.detail}`),
          },
          {
            heading: "Next steps",
            lines: meta.nextSteps,
          },
          {
            heading: "Inputs used",
            lines: [
              `Age: ${result.inputs.age} years`,
              `Sex: ${result.inputs.sex === "female" ? "Female" : "Male"}`,
              `Total cholesterol: ${result.inputs.totalCholesterol} mg/dL`,
              `HDL cholesterol: ${result.inputs.hdl} mg/dL`,
              `Systolic blood pressure: ${result.inputs.systolic} mm Hg`,
              `Treated for high blood pressure: ${result.inputs.treated ? "Yes" : "No"}`,
              `Current smoker: ${result.inputs.smoker ? "Yes" : "No"}`,
              `Diabetes: ${result.inputs.diabetic ? "Yes" : "No"}`,
            ],
          },
        ],
        footer:
          "Educational estimate only — not a diagnosis. Discuss results with a clinician.",
      },
      `cardiovascular-risk-${new Date(result.computedAt).toISOString().slice(0, 10)}`,
    );
  };

  const meta = result ? BAND_META[result.band] : null;

  const autofillLabel = useMemo(() => {
    if (!latestReading) return null;
    return `${Math.round(latestReading.value)} ${latestReading.unit} · ${formatPdfDate(latestReading.effectiveAt)}`;
  }, [latestReading]);

  /** Live tone for each vitals field, computed from the shared reference data. */
  const vitalTones = useMemo(() => {
    const tones: Record<string, VitalTone | null> = {};
    for (const field of VITAL_FIELDS) {
      const marker = getMarker(field.markerId);
      const value = parseNumber(vitals[field.key] ?? "");
      tones[field.key] =
        marker && value !== null ? toneForMarker(marker, value) : null;
    }
    for (const vital of SIMPLE_VITALS) {
      const value = parseNumber(vitals[vital.key] ?? "");
      tones[vital.key] = value !== null ? toneForSimple(vital, value) : null;
    }
    const height = parseNumber(vitals.height ?? "");
    const weight = parseNumber(vitals.weight ?? "");
    const bmi =
      height !== null && weight !== null ? computeBmi(height, weight) : null;
    tones.bmi = bmi !== null ? bmiTone(bmi) : null;
    return tones;
  }, [vitals]);

  const bmiValue = useMemo(() => {
    const height = parseNumber(vitals.height ?? "");
    const weight = parseNumber(vitals.weight ?? "");
    if (height === null || weight === null) return null;
    return computeBmi(height, weight);
  }, [vitals]);

  const handleAnalyzeVitals = async () => {
    const entries = VITAL_FIELDS.flatMap((field) => {
      const value = parseNumber(vitals[field.key] ?? "");
      return value === null ? [] : [{ markerId: field.markerId, value }];
    });
    const analysis = analyze(entries);
    setVitalsAnalysis(analysis);
    setVitalsSaved(false);

    // Save each entered vital as a timestamped Observation in the record.
    const now = Date.now();
    const saves: Promise<unknown>[] = [];
    for (const field of VITAL_FIELDS) {
      const value = parseNumber(vitals[field.key] ?? "");
      const marker = getMarker(field.markerId);
      if (value === null || !marker) continue;
      saves.push(
        create("Observation", {
          code: field.markerId,
          display: marker.name,
          value,
          unit: marker.unit,
          effectiveAt: now,
          source: "manual",
        }),
      );
    }
    for (const vital of SIMPLE_VITALS) {
      const value = parseNumber(vitals[vital.key] ?? "");
      if (value === null) continue;
      saves.push(
        create("Observation", {
          code: vital.key,
          display: vital.label,
          value,
          unit: vital.unit,
          effectiveAt: now,
          source: "manual",
        }),
      );
    }
    if (bmiValue !== null) {
      saves.push(
        create("Observation", {
          code: BMI_MARKER_ID,
          display: "Body mass index (BMI)",
          value: bmiValue,
          unit: "kg/m²",
          effectiveAt: now,
          source: "manual",
        }),
      );
    }
    await Promise.all(saves);
    setVitalsSaved(saves.length > 0);
  };

  const handleClearVitals = () => {
    setVitals(EMPTY_VITALS);
    setVitalsAnalysis(null);
    setVitalsSaved(false);
  };

  const hasVitalsInput = Object.values(vitals).some((v) => v.trim() !== "");

  return (
    <section data-ocid="predict.page" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Assessment
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Predict
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Estimate your 10-year cardiovascular risk from a published model, and
          check your vitals against cited normal ranges. Your numbers stay in
          this browser.
        </p>
      </header>

      {vitalsAnalysis?.redFlag ? (
        <div
          data-ocid="predict.emergency_state"
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
                One or more of your vitals is in a critical range. Stop and call
                for help right away.
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-1.5 pl-1">
            {vitalsAnalysis.redFlagReasons.map((reason) => (
              <li
                key={reason}
                className="flex items-start gap-2 text-sm leading-relaxed text-foreground"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive"
                />
                {reason}
              </li>
            ))}
          </ul>
          <a
            href={emergencyTelHref()}
            data-ocid="predict.emergency_call_button"
            className="tap-target inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-5 text-base font-semibold text-destructive-foreground transition-smooth hover:opacity-90"
          >
            <Phone aria-hidden="true" className="size-5" />
            Call {EMERGENCY_NUMBER}
          </a>
          <p className="text-xs text-muted-foreground">
            No condition list is shown while a critical vital is present.
          </p>
        </div>
      ) : null}

      {result && meta ? (
        <div className="flex flex-col gap-4">
          <Card
            data-ocid="predict.result_card"
            className="relative overflow-hidden rounded-xl border shadow-subtle motion-safe:animate-fade-in-up"
          >
            <span
              aria-hidden="true"
              className={cn("absolute inset-y-0 left-0 w-1", meta.railClass)}
            />
            <CardHeader className="pl-7">
              <div className="flex items-center justify-between gap-3">
                <CardDescription className="text-xs font-semibold uppercase tracking-widest">
                  10-year risk
                </CardDescription>
                <Badge
                  data-ocid="predict.band_badge"
                  className={cn("rounded-full border", meta.badgeClass)}
                >
                  {meta.label}
                </Badge>
              </div>
              <CardTitle className="flex items-baseline gap-2 font-mono text-5xl font-bold tracking-tight">
                <span data-ocid="predict.score_value">
                  {result.riskPercent.toFixed(1)}
                </span>
                <span className="font-body text-2xl font-semibold text-muted-foreground">
                  %
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pl-7">
              <RiskGauge riskPercent={result.riskPercent} band={result.band} />
              <p
                data-ocid="predict.summary"
                className="text-base leading-relaxed text-foreground"
              >
                {meta.summary}
              </p>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Model: {MODEL_NAME} ({MODEL_VERSION}).
                </span>
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border shadow-subtle">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp
                  aria-hidden="true"
                  className="size-5 text-primary"
                />
                Top contributing factors
              </CardTitle>
              <CardDescription>
                The three inputs that raise your estimate the most.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul
                data-ocid="predict.factors_list"
                className="flex flex-col gap-3"
              >
                {result.factors.map((factor, index) => (
                  <li
                    key={factor.label}
                    data-ocid={`predict.factor.${index + 1}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {factor.label}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {factor.detail}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "font-mono text-sm font-semibold",
                        factor.contribution >= 0
                          ? "text-destructive"
                          : "text-success",
                      )}
                    >
                      {factor.contribution >= 0 ? "+" : ""}
                      {factor.contribution.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-xl border shadow-subtle">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-5 text-accent"
                />
                Next steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul
                data-ocid="predict.next_steps"
                className="flex flex-col gap-3"
              >
                {meta.nextSteps.map((step) => (
                  <li key={step} className="flex items-start gap-3">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-accent"
                    />
                    <span className="text-sm leading-relaxed text-foreground">
                      {step}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              data-ocid="predict.download_button"
              onClick={handleDownload}
              className="tap-target flex-1 rounded-lg bg-gradient-primary text-primary-foreground shadow-subtle transition-smooth hover:shadow-elevated"
            >
              <Download aria-hidden="true" className="size-4" />
              Download PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              data-ocid="predict.recalculate_button"
              onClick={handleRecalculate}
              className="tap-target flex-1 rounded-lg"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Recalculate
            </Button>
          </div>
        </div>
      ) : (
        <form
          data-ocid="predict.form"
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4"
        >
          <Card className="rounded-xl border shadow-subtle">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calculator
                  aria-hidden="true"
                  className="size-5 text-primary"
                />
                Your details
              </CardTitle>
              <CardDescription>
                Enter the values the model needs. Nothing leaves your device.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="predict-age">Age (years)</Label>
                  <Input
                    id="predict-age"
                    data-ocid="predict.age_input"
                    type="number"
                    inputMode="numeric"
                    min={30}
                    max={74}
                    value={inputs.age}
                    aria-invalid={Boolean(errors.age)}
                    aria-describedby={
                      errors.age ? "predict-age-error" : undefined
                    }
                    onChange={(e) => update("age", e.target.value)}
                    className="tap-target"
                  />
                  {errors.age ? (
                    <p
                      id="predict-age-error"
                      data-ocid="predict.age_error"
                      className="text-xs font-medium text-destructive"
                    >
                      {errors.age}
                    </p>
                  ) : null}
                </div>

                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium">Sex</legend>
                  <RadioGroup
                    value={inputs.sex}
                    onValueChange={(value) => update("sex", value as Sex)}
                    className="grid grid-cols-2 gap-2"
                  >
                    <Label
                      htmlFor="predict-sex-female"
                      className="tap-target cursor-pointer items-center justify-center gap-2 rounded-lg border border-input px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                    >
                      <RadioGroupItem
                        id="predict-sex-female"
                        data-ocid="predict.sex_female_radio"
                        value="female"
                      />
                      Female
                    </Label>
                    <Label
                      htmlFor="predict-sex-male"
                      className="tap-target cursor-pointer items-center justify-center gap-2 rounded-lg border border-input px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                    >
                      <RadioGroupItem
                        id="predict-sex-male"
                        data-ocid="predict.sex_male_radio"
                        value="male"
                      />
                      Male
                    </Label>
                  </RadioGroup>
                </fieldset>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="predict-total">
                    Total cholesterol (mg/dL)
                  </Label>
                  <Input
                    id="predict-total"
                    data-ocid="predict.total_cholesterol_input"
                    type="number"
                    inputMode="numeric"
                    value={inputs.totalCholesterol}
                    aria-invalid={Boolean(errors.totalCholesterol)}
                    aria-describedby={
                      errors.totalCholesterol
                        ? "predict-total-error"
                        : undefined
                    }
                    onChange={(e) => update("totalCholesterol", e.target.value)}
                    className="tap-target"
                  />
                  {errors.totalCholesterol ? (
                    <p
                      id="predict-total-error"
                      data-ocid="predict.total_cholesterol_error"
                      className="text-xs font-medium text-destructive"
                    >
                      {errors.totalCholesterol}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="predict-hdl">HDL cholesterol (mg/dL)</Label>
                  <Input
                    id="predict-hdl"
                    data-ocid="predict.hdl_input"
                    type="number"
                    inputMode="numeric"
                    value={inputs.hdl}
                    aria-invalid={Boolean(errors.hdl)}
                    aria-describedby={
                      errors.hdl ? "predict-hdl-error" : undefined
                    }
                    onChange={(e) => update("hdl", e.target.value)}
                    className="tap-target"
                  />
                  {errors.hdl ? (
                    <p
                      id="predict-hdl-error"
                      data-ocid="predict.hdl_error"
                      className="text-xs font-medium text-destructive"
                    >
                      {errors.hdl}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="predict-systolic">
                  Systolic blood pressure (mm Hg)
                </Label>
                <Input
                  id="predict-systolic"
                  data-ocid="predict.systolic_input"
                  type="number"
                  inputMode="numeric"
                  value={inputs.systolic}
                  aria-invalid={Boolean(errors.systolic)}
                  aria-describedby={
                    errors.systolic ? "predict-systolic-error" : undefined
                  }
                  onChange={(e) => update("systolic", e.target.value)}
                  className="tap-target"
                />
                {errors.systolic ? (
                  <p
                    id="predict-systolic-error"
                    data-ocid="predict.systolic_error"
                    className="text-xs font-medium text-destructive"
                  >
                    {errors.systolic}
                  </p>
                ) : null}
                {latestReading ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/10 p-3">
                    <p className="flex items-center gap-2 text-xs text-foreground">
                      <Bluetooth
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-accent"
                      />
                      <span>
                        Latest Bluetooth reading:{" "}
                        <span className="font-mono font-semibold">
                          {autofillLabel}
                        </span>
                      </span>
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      data-ocid="predict.autofill_button"
                      onClick={handleAutofill}
                      className="tap-target self-start rounded-lg border-accent/50 text-accent hover:bg-accent/15 hover:text-accent"
                    >
                      <Activity aria-hidden="true" className="size-4" />
                      Use latest reading
                    </Button>
                    {autofilled ? (
                      <p
                        data-ocid="predict.autofill_success"
                        className="text-xs font-medium text-accent"
                      >
                        Systolic pressure filled from your latest reading.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Bluetooth
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0"
                    />
                    <span>
                      No Bluetooth blood-pressure reading yet. Connect a device
                      on the Connect screen to fill this automatically.
                    </span>
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="predict-treated" className="cursor-pointer">
                    Treated for high blood pressure
                  </Label>
                  <Switch
                    id="predict-treated"
                    data-ocid="predict.treated_switch"
                    checked={inputs.treated}
                    onCheckedChange={(checked) => update("treated", checked)}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="predict-smoker" className="cursor-pointer">
                    Current smoker
                  </Label>
                  <Switch
                    id="predict-smoker"
                    data-ocid="predict.smoker_switch"
                    checked={inputs.smoker}
                    onCheckedChange={(checked) => update("smoker", checked)}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="predict-diabetic" className="cursor-pointer">
                    Diabetes
                  </Label>
                  <Switch
                    id="predict-diabetic"
                    data-ocid="predict.diabetic_switch"
                    checked={inputs.diabetic}
                    onCheckedChange={(checked) => update("diabetic", checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            data-ocid="predict.submit_button"
            className="tap-target w-full rounded-lg bg-gradient-primary text-primary-foreground shadow-subtle transition-smooth hover:shadow-elevated"
          >
            <Gauge aria-hidden="true" className="size-4" />
            Calculate risk
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0"
            />
            <span>
              This estimate is educational and is not a diagnosis. Always
              discuss results with a qualified clinician.
            </span>
          </p>
        </form>
      )}

      <Card
        data-ocid="predict.vitals_card"
        className="rounded-xl border shadow-subtle"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HeartPulse aria-hidden="true" className="size-5 text-accent" />
            Your vitals
          </CardTitle>
          <CardDescription>
            Check blood pressure, heart rate, temperature, oxygen saturation and
            BMI against cited normal ranges. Entered vitals are saved to your
            record.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            {VITAL_FIELDS.map((field) => {
              const marker = getMarker(field.markerId);
              if (!marker) return null;
              return (
                <VitalInput
                  key={field.key}
                  id={field.key}
                  label={field.label}
                  hint={field.hint}
                  unit={marker.unit}
                  value={vitals[field.key] ?? ""}
                  tone={vitalTones[field.key] ?? null}
                  rangeText={markerRangeText(marker)}
                  citation={marker.citation}
                  onChange={(value) => updateVital(field.key, value)}
                />
              );
            })}
            {SIMPLE_VITALS.map((vital) => (
              <VitalInput
                key={vital.key}
                id={vital.key}
                label={vital.label}
                hint={vital.hint}
                unit={vital.unit}
                value={vitals[vital.key] ?? ""}
                tone={vitalTones[vital.key] ?? null}
                rangeText={simpleRangeText(vital)}
                citation={vital.citation}
                onChange={(value) => updateVital(vital.key, value)}
              />
            ))}
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">
                Body mass index (BMI)
              </h3>
              <p className="text-xs text-muted-foreground">
                Enter your height and weight to work out BMI. WHO classifies
                18.5–24.9 as the healthy range.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="vitals-height">Height</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="vitals-height"
                    data-ocid="predict.vitals.height_input"
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g. 172"
                    value={vitals.height ?? ""}
                    onChange={(e) => updateVital("height", e.target.value)}
                    className="tap-target"
                  />
                  <span className="shrink-0 text-sm font-medium text-muted-foreground">
                    cm
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="vitals-weight">Weight</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="vitals-weight"
                    data-ocid="predict.vitals.weight_input"
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g. 70"
                    value={vitals.weight ?? ""}
                    onChange={(e) => updateVital("weight", e.target.value)}
                    className="tap-target"
                  />
                  <span className="shrink-0 text-sm font-medium text-muted-foreground">
                    kg
                  </span>
                </div>
              </div>
            </div>
            {bmiValue !== null ? (
              <div
                data-ocid="predict.vitals.bmi_indicator"
                className={cn(
                  "inline-flex items-center gap-2 self-start rounded-full border px-3 py-1 text-sm font-medium",
                  TONE_META[bmiTone(bmiValue)].badgeClass,
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 rounded-full",
                    TONE_META[bmiTone(bmiValue)].dotClass,
                  )}
                />
                BMI {bmiValue} kg/m² · {bmiLabel(bmiValue)}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              data-ocid="predict.vitals.analyze_button"
              onClick={() => void handleAnalyzeVitals()}
              disabled={!hasVitalsInput}
              className="tap-target flex-1 rounded-lg bg-gradient-primary text-primary-foreground shadow-subtle transition-smooth hover:shadow-elevated"
            >
              <HeartPulse aria-hidden="true" className="size-4" />
              Check vitals
            </Button>
            <Button
              type="button"
              variant="outline"
              data-ocid="predict.vitals.clear_button"
              onClick={handleClearVitals}
              disabled={!hasVitalsInput}
              className="tap-target flex-1 rounded-lg"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Clear vitals
            </Button>
          </div>

          {vitalsSaved ? (
            <output
              data-ocid="predict.vitals.save_success_state"
              className="block rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-foreground"
            >
              Vitals saved to your record.
            </output>
          ) : null}

          {vitalsAnalysis && !vitalsAnalysis.redFlag ? (
            <div
              data-ocid="predict.vitals.results_section"
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Vitals range check
                </h3>
                <ul
                  data-ocid="predict.vitals.flags_list"
                  className="flex flex-col gap-2"
                >
                  {vitalsAnalysis.flags.map((flag, index) => (
                    <li
                      key={flag.markerId}
                      data-ocid={`predict.vitals.flag.${index + 1}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {flag.markerName}
                        </span>
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          {flag.explanation}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                          TONE_META[flag.level].badgeClass,
                        )}
                      >
                        {TONE_META[flag.level].label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {vitalsAnalysis.ranked.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Possible patterns
                  </h3>
                  <ul
                    data-ocid="predict.vitals.conditions_list"
                    className="flex flex-col gap-3"
                  >
                    {vitalsAnalysis.ranked.map((condition, index) => (
                      <li
                        key={condition.id}
                        data-ocid={`predict.vitals.condition.${index + 1}`}
                        className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3"
                      >
                        <span className="text-sm font-semibold text-foreground">
                          {condition.name}
                        </span>
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          {condition.explanation}
                        </span>
                        <ul className="flex flex-col gap-1">
                          {condition.reasons.map((reason) => (
                            <li
                              key={reason}
                              className="flex items-start gap-2 text-xs text-foreground"
                            >
                              <span
                                aria-hidden="true"
                                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent"
                              />
                              {reason}
                            </li>
                          ))}
                        </ul>
                        <span className="text-xs text-muted-foreground">
                          {condition.nextSteps} · {condition.citation}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p
                  data-ocid="predict.vitals.no_conditions"
                  className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-foreground"
                >
                  No out-of-range pattern was found in the vitals you entered.
                </p>
              )}
            </div>
          ) : null}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Ranges are cited to WHO, NICE and AHA guidance. This check is
              educational and is not a diagnosis.
            </span>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

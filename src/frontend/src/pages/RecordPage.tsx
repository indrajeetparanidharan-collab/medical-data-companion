import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type AllergyIntolerance,
  type Condition,
  type EntityMap,
  type EntityName,
  type MedicationStatement,
  type Observation,
  type Patient,
  type QuestionnaireResponse,
  clearAll,
  create,
  list,
  remove,
  update,
} from "@/lib/db";
import { downloadPdf, formatPdfDate } from "@/lib/pdf";
import {
  type TrendDirection,
  type TrendPoint,
  type TrendResult,
  compareTrend,
  sparklinePoints,
  trendLabel,
} from "@/lib/trends";
import { cn } from "@/lib/utils";
import {
  Activity,
  ClipboardList,
  Download,
  FileText,
  HeartPulse,
  Minus,
  Pencil,
  Pill,
  Plus,
  ShieldAlert,
  Stethoscope,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ------------------------------------------------------------------ */
/* Entity metadata                                                     */
/* ------------------------------------------------------------------ */

interface EntityMeta {
  name: EntityName;
  label: string;
  singular: string;
  icon: typeof User;
  accent: string;
}

const ENTITY_META: EntityMeta[] = [
  {
    name: "Patient",
    label: "Profile",
    singular: "profile",
    icon: User,
    accent: "text-primary",
  },
  {
    name: "Observation",
    label: "Observations",
    singular: "observation",
    icon: Activity,
    accent: "text-accent",
  },
  {
    name: "Condition",
    label: "Conditions",
    singular: "condition",
    icon: Stethoscope,
    accent: "text-primary",
  },
  {
    name: "MedicationStatement",
    label: "Medications",
    singular: "medication",
    icon: Pill,
    accent: "text-accent",
  },
  {
    name: "AllergyIntolerance",
    label: "Allergies",
    singular: "allergy",
    icon: ShieldAlert,
    accent: "text-warning",
  },
  {
    name: "QuestionnaireResponse",
    label: "Questionnaires",
    singular: "questionnaire",
    icon: ClipboardList,
    accent: "text-primary",
  },
];

const META_BY_NAME = Object.fromEntries(
  ENTITY_META.map((meta) => [meta.name, meta]),
) as Record<EntityName, EntityMeta>;

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

function formatDateTime(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** A single labelled reading row inside a record card. */
function ReadingRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 text-right text-sm text-foreground",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Record card                                                         */
/* ------------------------------------------------------------------ */

interface RecordCardProps {
  title: string;
  subtitle?: string;
  railClass: string;
  badge?: ReactNode;
  rows: { label: string; value: ReactNode; mono?: boolean }[];
  sparkline?: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}

function RecordCard({
  title,
  subtitle,
  railClass,
  badge,
  rows,
  sparkline,
  onEdit,
  onDelete,
  index,
}: RecordCardProps) {
  return (
    <article
      data-ocid={`record.item.${index + 1}`}
      className="relative overflow-hidden rounded-xl border border-border bg-card shadow-subtle transition-smooth hover:border-primary/40"
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-y-0 left-0 w-1", railClass)}
      />
      <div className="flex flex-col gap-3 p-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold text-foreground">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {badge}
        </div>
        <dl className="flex flex-col gap-2">
          {rows.map((row) => (
            <ReadingRow
              key={row.label}
              label={row.label}
              value={row.value}
              mono={row.mono}
            />
          ))}
        </dl>
        {sparkline}
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-ocid={`record.edit_button.${index + 1}`}
            className="tap-target rounded-lg"
            onClick={onEdit}
          >
            <Pencil aria-hidden="true" className="size-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-ocid={`record.delete_button.${index + 1}`}
            className="tap-target rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Delete
          </Button>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  ocid,
}: {
  icon: typeof User;
  title: string;
  description: string;
  action?: ReactNode;
  ocid: string;
}) {
  return (
    <div
      data-ocid={ocid}
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-display text-base font-semibold text-foreground">
          {title}
        </p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form field primitives                                               */
/* ------------------------------------------------------------------ */

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Draft state                                                         */
/* ------------------------------------------------------------------ */

type Draft = Record<string, string>;

function emptyDraft(entity: EntityName): Draft {
  switch (entity) {
    case "Patient":
      return { name: "", birthDate: "", sex: "", notes: "" };
    case "Observation":
      return {
        code: "",
        display: "",
        value: "",
        unit: "",
        effectiveAt: "",
        notes: "",
      };
    case "Condition":
      return {
        code: "",
        display: "",
        clinicalStatus: "active",
        onsetDate: "",
        notes: "",
      };
    case "MedicationStatement":
      return {
        medication: "",
        dose: "",
        frequency: "",
        status: "active",
        startedAt: "",
        notes: "",
      };
    case "AllergyIntolerance":
      return { substance: "", reaction: "", severity: "mild", notes: "" };
    case "QuestionnaireResponse":
      return { questionnaire: "", answers: "", completedAt: "" };
  }
}

function draftFromRecord<K extends EntityName>(
  entity: K,
  record: EntityMap[K],
): Draft {
  switch (entity) {
    case "Patient": {
      const r = record as Patient;
      return {
        name: r.name,
        birthDate: r.birthDate ?? "",
        sex: r.sex ?? "",
        notes: r.notes ?? "",
      };
    }
    case "Observation": {
      const r = record as Observation;
      return {
        code: r.code,
        display: r.display,
        value: String(r.value),
        unit: r.unit,
        effectiveAt: toLocalInput(r.effectiveAt),
        notes: r.notes ?? "",
      };
    }
    case "Condition": {
      const r = record as Condition;
      return {
        code: r.code,
        display: r.display,
        clinicalStatus: r.clinicalStatus,
        onsetDate: r.onsetDate ?? "",
        notes: r.notes ?? "",
      };
    }
    case "MedicationStatement": {
      const r = record as MedicationStatement;
      return {
        medication: r.medication,
        dose: r.dose ?? "",
        frequency: r.frequency ?? "",
        status: r.status,
        startedAt: r.startedAt ?? "",
        notes: r.notes ?? "",
      };
    }
    case "AllergyIntolerance": {
      const r = record as AllergyIntolerance;
      return {
        substance: r.substance,
        reaction: r.reaction ?? "",
        severity: r.severity,
        notes: r.notes ?? "",
      };
    }
    case "QuestionnaireResponse": {
      const r = record as QuestionnaireResponse;
      return {
        questionnaire: r.questionnaire,
        answers: Object.entries(r.answers)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n"),
        completedAt: toLocalInput(r.completedAt),
      };
    }
  }
}

function toLocalInput(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseAnswers(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) {
      out[trimmed] = "";
    } else {
      out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
  return out;
}

/** Validate a draft and return a user-facing error, or null when valid. */
function validateDraft(entity: EntityName, draft: Draft): string | null {
  const required = (key: string, label: string) =>
    draft[key]?.trim() ? null : `${label} is required.`;
  switch (entity) {
    case "Patient":
      return required("name", "Name");
    case "Observation": {
      const missing = required("display", "Reading name");
      if (missing) return missing;
      if (!draft.value.trim() || Number.isNaN(Number(draft.value)))
        return "Enter a numeric reading value.";
      return required("unit", "Unit");
    }
    case "Condition":
      return required("display", "Condition name");
    case "MedicationStatement":
      return required("medication", "Medication name");
    case "AllergyIntolerance":
      return required("substance", "Substance");
    case "QuestionnaireResponse":
      return required("questionnaire", "Questionnaire name");
  }
}

/** Build the record payload from a validated draft. */
function payloadFromDraft(
  entity: EntityName,
  draft: Draft,
): Record<string, unknown> {
  const now = Date.now();
  switch (entity) {
    case "Patient":
      return {
        name: draft.name.trim(),
        birthDate: draft.birthDate || undefined,
        sex: draft.sex || undefined,
        notes: draft.notes.trim() || undefined,
      };
    case "Observation":
      return {
        code: draft.code.trim() || draft.display.trim().toLowerCase(),
        display: draft.display.trim(),
        value: Number(draft.value),
        unit: draft.unit.trim(),
        effectiveAt: draft.effectiveAt
          ? new Date(draft.effectiveAt).getTime()
          : now,
        source: "manual" as const,
        notes: draft.notes.trim() || undefined,
      };
    case "Condition":
      return {
        code: draft.code.trim() || draft.display.trim().toLowerCase(),
        display: draft.display.trim(),
        clinicalStatus: draft.clinicalStatus as Condition["clinicalStatus"],
        onsetDate: draft.onsetDate || undefined,
        notes: draft.notes.trim() || undefined,
      };
    case "MedicationStatement":
      return {
        medication: draft.medication.trim(),
        dose: draft.dose.trim() || undefined,
        frequency: draft.frequency.trim() || undefined,
        status: draft.status as MedicationStatement["status"],
        startedAt: draft.startedAt || undefined,
        notes: draft.notes.trim() || undefined,
      };
    case "AllergyIntolerance":
      return {
        substance: draft.substance.trim(),
        reaction: draft.reaction.trim() || undefined,
        severity: draft.severity as AllergyIntolerance["severity"],
        notes: draft.notes.trim() || undefined,
      };
    case "QuestionnaireResponse":
      return {
        questionnaire: draft.questionnaire.trim(),
        answers: parseAnswers(draft.answers),
        completedAt: draft.completedAt
          ? new Date(draft.completedAt).getTime()
          : now,
      };
  }
}

/* ------------------------------------------------------------------ */
/* Entity form dialog                                                  */
/* ------------------------------------------------------------------ */

interface EntityFormProps {
  entity: EntityName;
  open: boolean;
  editingId: string | null;
  initial: Draft;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: Draft) => Promise<void>;
}

function EntityForm({
  entity,
  open,
  editingId,
  initial,
  onOpenChange,
  onSubmit,
}: EntityFormProps) {
  const meta = META_BY_NAME[entity];
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setError(null);
      setPending(false);
    }
  }, [open, initial]);

  const set = (key: string, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateDraft(entity, draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setPending(true);
    try {
      await onSubmit(draft);
      onOpenChange(false);
    } catch {
      setError("Could not save this entry. Please try again.");
      setPending(false);
    }
  };

  const idPrefix = `record-${entity.toLowerCase()}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-ocid="record.form.modal"
        className="max-h-[90dvh] overflow-y-auto bg-card"
      >
        <DialogHeader>
          <DialogTitle className="font-display">
            {editingId ? `Edit ${meta.singular}` : `Add ${meta.singular}`}
          </DialogTitle>
          <DialogDescription>
            Saved only in this browser. Nothing is sent to a server.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          data-ocid="record.form"
        >
          {entity === "Patient" ? (
            <>
              <Field id={`${idPrefix}-name`} label="Full name">
                <Input
                  id={`${idPrefix}-name`}
                  data-ocid="record.form.name_input"
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  autoComplete="name"
                />
              </Field>
              <Field id={`${idPrefix}-birth`} label="Date of birth">
                <Input
                  id={`${idPrefix}-birth`}
                  type="date"
                  data-ocid="record.form.birthdate_input"
                  value={draft.birthDate}
                  onChange={(e) => set("birthDate", e.target.value)}
                />
              </Field>
              <Field id={`${idPrefix}-sex`} label="Sex">
                <Input
                  id={`${idPrefix}-sex`}
                  data-ocid="record.form.sex_input"
                  value={draft.sex}
                  onChange={(e) => set("sex", e.target.value)}
                />
              </Field>
              <Field id={`${idPrefix}-notes`} label="Notes">
                <Textarea
                  id={`${idPrefix}-notes`}
                  data-ocid="record.form.notes_input"
                  value={draft.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
            </>
          ) : null}

          {entity === "Observation" ? (
            <>
              <Field id={`${idPrefix}-display`} label="Reading name">
                <Input
                  id={`${idPrefix}-display`}
                  data-ocid="record.form.display_input"
                  placeholder="e.g. Blood pressure systolic"
                  value={draft.display}
                  onChange={(e) => set("display", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id={`${idPrefix}-value`} label="Value">
                  <Input
                    id={`${idPrefix}-value`}
                    type="number"
                    inputMode="decimal"
                    data-ocid="record.form.value_input"
                    value={draft.value}
                    onChange={(e) => set("value", e.target.value)}
                  />
                </Field>
                <Field id={`${idPrefix}-unit`} label="Unit">
                  <Input
                    id={`${idPrefix}-unit`}
                    data-ocid="record.form.unit_input"
                    placeholder="mmHg"
                    value={draft.unit}
                    onChange={(e) => set("unit", e.target.value)}
                  />
                </Field>
              </div>
              <Field id={`${idPrefix}-code`} label="Code (optional)">
                <Input
                  id={`${idPrefix}-code`}
                  data-ocid="record.form.code_input"
                  value={draft.code}
                  onChange={(e) => set("code", e.target.value)}
                />
              </Field>
              <Field id={`${idPrefix}-effective`} label="Measured at">
                <Input
                  id={`${idPrefix}-effective`}
                  type="datetime-local"
                  data-ocid="record.form.effective_input"
                  value={draft.effectiveAt}
                  onChange={(e) => set("effectiveAt", e.target.value)}
                />
              </Field>
              <Field id={`${idPrefix}-notes`} label="Notes">
                <Textarea
                  id={`${idPrefix}-notes`}
                  data-ocid="record.form.notes_input"
                  value={draft.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
            </>
          ) : null}

          {entity === "Condition" ? (
            <>
              <Field id={`${idPrefix}-display`} label="Condition name">
                <Input
                  id={`${idPrefix}-display`}
                  data-ocid="record.form.display_input"
                  placeholder="e.g. Hypertension"
                  value={draft.display}
                  onChange={(e) => set("display", e.target.value)}
                />
              </Field>
              <Field id={`${idPrefix}-status`} label="Status">
                <Select
                  value={draft.clinicalStatus}
                  onValueChange={(value) => set("clinicalStatus", value)}
                >
                  <SelectTrigger
                    id={`${idPrefix}-status`}
                    data-ocid="record.form.status_select"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id={`${idPrefix}-onset`} label="Onset date">
                <Input
                  id={`${idPrefix}-onset`}
                  type="date"
                  data-ocid="record.form.onset_input"
                  value={draft.onsetDate}
                  onChange={(e) => set("onsetDate", e.target.value)}
                />
              </Field>
              <Field id={`${idPrefix}-notes`} label="Notes">
                <Textarea
                  id={`${idPrefix}-notes`}
                  data-ocid="record.form.notes_input"
                  value={draft.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
            </>
          ) : null}

          {entity === "MedicationStatement" ? (
            <>
              <Field id={`${idPrefix}-medication`} label="Medication name">
                <Input
                  id={`${idPrefix}-medication`}
                  data-ocid="record.form.medication_input"
                  placeholder="e.g. Lisinopril"
                  value={draft.medication}
                  onChange={(e) => set("medication", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id={`${idPrefix}-dose`} label="Dose">
                  <Input
                    id={`${idPrefix}-dose`}
                    data-ocid="record.form.dose_input"
                    placeholder="10 mg"
                    value={draft.dose}
                    onChange={(e) => set("dose", e.target.value)}
                  />
                </Field>
                <Field id={`${idPrefix}-frequency`} label="Frequency">
                  <Input
                    id={`${idPrefix}-frequency`}
                    data-ocid="record.form.frequency_input"
                    placeholder="Once daily"
                    value={draft.frequency}
                    onChange={(e) => set("frequency", e.target.value)}
                  />
                </Field>
              </div>
              <Field id={`${idPrefix}-status`} label="Status">
                <Select
                  value={draft.status}
                  onValueChange={(value) => set("status", value)}
                >
                  <SelectTrigger
                    id={`${idPrefix}-status`}
                    data-ocid="record.form.status_select"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="stopped">Stopped</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id={`${idPrefix}-started`} label="Started on">
                <Input
                  id={`${idPrefix}-started`}
                  type="date"
                  data-ocid="record.form.started_input"
                  value={draft.startedAt}
                  onChange={(e) => set("startedAt", e.target.value)}
                />
              </Field>
              <Field id={`${idPrefix}-notes`} label="Notes">
                <Textarea
                  id={`${idPrefix}-notes`}
                  data-ocid="record.form.notes_input"
                  value={draft.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
            </>
          ) : null}

          {entity === "AllergyIntolerance" ? (
            <>
              <Field id={`${idPrefix}-substance`} label="Substance">
                <Input
                  id={`${idPrefix}-substance`}
                  data-ocid="record.form.substance_input"
                  placeholder="e.g. Penicillin"
                  value={draft.substance}
                  onChange={(e) => set("substance", e.target.value)}
                />
              </Field>
              <Field id={`${idPrefix}-reaction`} label="Reaction">
                <Input
                  id={`${idPrefix}-reaction`}
                  data-ocid="record.form.reaction_input"
                  placeholder="e.g. Rash"
                  value={draft.reaction}
                  onChange={(e) => set("reaction", e.target.value)}
                />
              </Field>
              <Field id={`${idPrefix}-severity`} label="Severity">
                <Select
                  value={draft.severity}
                  onValueChange={(value) => set("severity", value)}
                >
                  <SelectTrigger
                    id={`${idPrefix}-severity`}
                    data-ocid="record.form.severity_select"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id={`${idPrefix}-notes`} label="Notes">
                <Textarea
                  id={`${idPrefix}-notes`}
                  data-ocid="record.form.notes_input"
                  value={draft.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
            </>
          ) : null}

          {entity === "QuestionnaireResponse" ? (
            <>
              <Field
                id={`${idPrefix}-questionnaire`}
                label="Questionnaire name"
              >
                <Input
                  id={`${idPrefix}-questionnaire`}
                  data-ocid="record.form.questionnaire_input"
                  placeholder="e.g. Symptom check"
                  value={draft.questionnaire}
                  onChange={(e) => set("questionnaire", e.target.value)}
                />
              </Field>
              <Field id={`${idPrefix}-answers`} label="Answers">
                <Textarea
                  id={`${idPrefix}-answers`}
                  data-ocid="record.form.answers_input"
                  placeholder={
                    "One per line, e.g.\nChest pain: no\nShortness of breath: yes"
                  }
                  className="min-h-28"
                  value={draft.answers}
                  onChange={(e) => set("answers", e.target.value)}
                />
              </Field>
              <Field id={`${idPrefix}-completed`} label="Completed at">
                <Input
                  id={`${idPrefix}-completed`}
                  type="datetime-local"
                  data-ocid="record.form.completed_input"
                  value={draft.completedAt}
                  onChange={(e) => set("completedAt", e.target.value)}
                />
              </Field>
            </>
          ) : null}

          {error ? (
            <p
              role="alert"
              data-ocid="record.form.error_state"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              data-ocid="record.form.cancel_button"
              className="tap-target rounded-lg"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-ocid="record.form.submit_button"
              className="tap-target rounded-lg"
              disabled={pending}
            >
              {pending ? "Saving…" : editingId ? "Save changes" : "Add entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

interface TimelineEntry {
  key: string;
  entity: EntityName;
  title: string;
  detail: string;
  at: number;
}

function buildTimeline(
  data: Record<EntityName, EntityMap[EntityName][]>,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const patient of data.Patient as Patient[]) {
    entries.push({
      key: `Patient-${patient.id}`,
      entity: "Patient",
      title: patient.name,
      detail: "Profile created",
      at: patient.createdAt,
    });
  }
  for (const obs of data.Observation as Observation[]) {
    entries.push({
      key: `Observation-${obs.id}`,
      entity: "Observation",
      title: `${obs.display} — ${obs.value} ${obs.unit}`,
      detail:
        obs.source === "bluetooth" ? "From Bluetooth device" : "Manual entry",
      at: obs.effectiveAt,
    });
  }
  for (const cond of data.Condition as Condition[]) {
    entries.push({
      key: `Condition-${cond.id}`,
      entity: "Condition",
      title: cond.display,
      detail: `Condition · ${cond.clinicalStatus}`,
      at: cond.createdAt,
    });
  }
  for (const med of data.MedicationStatement as MedicationStatement[]) {
    entries.push({
      key: `MedicationStatement-${med.id}`,
      entity: "MedicationStatement",
      title: med.medication,
      detail:
        [med.dose, med.frequency].filter(Boolean).join(" · ") || "Medication",
      at: med.createdAt,
    });
  }
  for (const allergy of data.AllergyIntolerance as AllergyIntolerance[]) {
    entries.push({
      key: `AllergyIntolerance-${allergy.id}`,
      entity: "AllergyIntolerance",
      title: allergy.substance,
      detail: `Allergy · ${allergy.severity}`,
      at: allergy.createdAt,
    });
  }
  for (const q of data.QuestionnaireResponse as QuestionnaireResponse[]) {
    entries.push({
      key: `QuestionnaireResponse-${q.id}`,
      entity: "QuestionnaireResponse",
      title: q.questionnaire,
      detail: `${Object.keys(q.answers).length} answers`,
      at: q.completedAt,
    });
  }

  return entries.sort((a, b) => b.at - a.at);
}

/* ------------------------------------------------------------------ */
/* Trends                                                              */
/* ------------------------------------------------------------------ */

/** A named series of readings for one observation marker over time. */
interface MarkerTrend {
  /** Stable key derived from the marker code. */
  key: string;
  /** Human-readable marker name. */
  label: string;
  /** Unit shared by the readings, or an empty string when mixed. */
  unit: string;
  /** The shared trends result for this marker. */
  trend: TrendResult;
}

/** One point rendered on a trend chart. */
interface ChartPoint {
  at: number;
  value: number;
  label: string;
}

/**
 * Group observations by marker and build a trend series for each, newest
 * marker first. The comparison itself lives in the shared trends module.
 */
function buildMarkerTrends(observations: Observation[]): MarkerTrend[] {
  const groups = new Map<string, Observation[]>();
  for (const obs of observations) {
    const key = (obs.code || obs.display).trim().toLowerCase();
    const bucket = groups.get(key);
    if (bucket) bucket.push(obs);
    else groups.set(key, [obs]);
  }

  const trends: MarkerTrend[] = [];
  for (const [key, readings] of groups) {
    const ordered = [...readings].sort((a, b) => a.effectiveAt - b.effectiveAt);
    const current = ordered[ordered.length - 1];
    const previous: TrendPoint[] = ordered
      .slice(0, -1)
      .map((obs) => ({ at: obs.effectiveAt, value: obs.value }));
    const trend = compareTrend(
      key,
      { at: current.effectiveAt, value: current.value },
      previous,
    );
    const units = new Set(ordered.map((obs) => obs.unit));
    trends.push({
      key,
      label: current.display,
      unit: units.size === 1 ? current.unit : "",
      trend,
    });
  }

  return trends.sort((a, b) => {
    const aLatest = a.trend.series[a.trend.series.length - 1]?.at ?? 0;
    const bLatest = b.trend.series[b.trend.series.length - 1]?.at ?? 0;
    return bLatest - aLatest;
  });
}

/** Convert a trend series into chart-ready points with short date labels. */
function toChartPoints(series: TrendPoint[]): ChartPoint[] {
  return series.map((point) => ({
    at: point.at,
    value: point.value,
    label: new Date(point.at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));
}

/** Icon and tone for a trend direction, reused by badges and cards. */
function directionMeta(direction: TrendDirection): {
  icon: typeof TrendingUp;
  className: string;
} {
  switch (direction) {
    case "rising":
      return { icon: TrendingUp, className: "text-warning" };
    case "falling":
      return { icon: TrendingDown, className: "text-accent" };
    default:
      return { icon: Minus, className: "text-muted-foreground" };
  }
}

/** A compact inline sparkline drawn from normalized trend points. */
function Sparkline({ series }: { series: TrendPoint[] }) {
  const points = sparklinePoints(series);
  if (points.length < 2) return null;
  const width = 96;
  const height = 28;
  const step = width / (points.length - 1);
  const path = points
    .map((value, index) => {
      const x = index * step;
      const y = height - value * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      className="h-7 w-24 shrink-0 text-accent"
      preserveAspectRatio="none"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A compact direction + sparkline strip shown on an observation card. */
function TrendStrip({ trend }: { trend: TrendResult }) {
  const { icon: DirectionIcon, className: directionClass } = directionMeta(
    trend.direction,
  );
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <DirectionIcon
          aria-hidden="true"
          className={cn("size-3.5", directionClass)}
        />
        {trendLabel(trend.direction)}
      </span>
      <Sparkline series={trend.series} />
    </div>
  );
}

/** A single marker trend card with a full line chart and direction badge. */
function TrendCard({ marker, index }: { marker: MarkerTrend; index: number }) {
  const { trend } = marker;
  const { icon: DirectionIcon, className: directionClass } = directionMeta(
    trend.direction,
  );
  const chartData = toChartPoints(trend.series);
  const latest = trend.series[trend.series.length - 1];
  const unitSuffix = marker.unit ? ` ${marker.unit}` : "";

  return (
    <article
      data-ocid={`record.trend.item.${index + 1}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-subtle"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-semibold text-foreground">
            {marker.label}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {trend.series.length}{" "}
            {trend.series.length === 1 ? "reading" : "readings"}
            {trend.hasHistory
              ? ` · ${trend.change > 0 ? "+" : ""}${trend.change.toFixed(1)}${unitSuffix} since last`
              : " · first reading"}
          </p>
        </div>
        <Badge
          variant="outline"
          data-ocid={`record.trend.direction.${index + 1}`}
          className={cn(
            "shrink-0 gap-1 rounded-full border-border bg-muted",
            directionClass,
          )}
        >
          <DirectionIcon aria-hidden="true" className="size-3.5" />
          {trendLabel(trend.direction)}
        </Badge>
      </div>

      <div
        data-ocid={`record.trend.chart.${index + 1}`}
        className="h-44 w-full rounded-lg border border-border bg-muted/30 p-2"
      >
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 12, bottom: 0, left: -20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={44}
                domain={["dataMin - 1", "dataMax + 1"]}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "0.75rem",
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--card-foreground)",
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--muted-foreground)" }}
                formatter={(value) => [
                  `${String(value)}${unitSuffix}`,
                  marker.label,
                ]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--accent)", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div
            data-ocid={`record.trend.chart.empty_state.${index + 1}`}
            className="flex h-full flex-col items-center justify-center gap-2 text-center"
          >
            <Activity
              aria-hidden="true"
              className="size-6 text-muted-foreground"
            />
            <p className="max-w-xs text-sm text-muted-foreground">
              Add another {marker.label} reading to see how it changes over
              time.
            </p>
          </div>
        )}
      </div>

      {latest ? (
        <p className="font-mono text-sm tabular-nums text-muted-foreground">
          Latest:{" "}
          <span className="font-semibold text-foreground">
            {latest.value}
            {unitSuffix}
          </span>{" "}
          on {formatDateTime(latest.at)}
        </p>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type RecordData = Record<EntityName, EntityMap[EntityName][]>;

const EMPTY_DATA: RecordData = {
  Patient: [],
  Observation: [],
  Condition: [],
  MedicationStatement: [],
  AllergyIntolerance: [],
  QuestionnaireResponse: [],
};

export default function RecordPage() {
  const [data, setData] = useState<RecordData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("timeline");
  const [formEntity, setFormEntity] = useState<EntityName | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formInitial, setFormInitial] = useState<Draft>({});
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [
      Patient,
      Observation,
      Condition,
      MedicationStatement,
      AllergyIntolerance,
      QuestionnaireResponse,
    ] = await Promise.all([
      list("Patient"),
      list("Observation"),
      list("Condition"),
      list("MedicationStatement"),
      list("AllergyIntolerance"),
      list("QuestionnaireResponse"),
    ]);
    setData({
      Patient,
      Observation,
      Condition,
      MedicationStatement,
      AllergyIntolerance,
      QuestionnaireResponse,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totals = useMemo(() => {
    const map = {} as Record<EntityName, number>;
    for (const meta of ENTITY_META) map[meta.name] = data[meta.name].length;
    return map;
  }, [data]);

  const totalCount = useMemo(
    () => Object.values(totals).reduce((sum, n) => sum + n, 0),
    [totals],
  );

  const timeline = useMemo(() => buildTimeline(data), [data]);

  const markerTrends = useMemo(
    () => buildMarkerTrends(data.Observation as Observation[]),
    [data.Observation],
  );

  const trendByMarker = useMemo(() => {
    const map = new Map<string, MarkerTrend>();
    for (const marker of markerTrends) map.set(marker.key, marker);
    return map;
  }, [markerTrends]);

  const openAdd = (entity: EntityName) => {
    setFormEntity(entity);
    setEditingId(null);
    setFormInitial(emptyDraft(entity));
  };

  const openEdit = <K extends EntityName>(entity: K, record: EntityMap[K]) => {
    setFormEntity(entity);
    setEditingId(record.id);
    setFormInitial(draftFromRecord(entity, record));
  };

  const handleSubmit = async (draft: Draft) => {
    if (!formEntity) return;
    const entity = formEntity;
    const payload = payloadFromDraft(entity, draft);
    if (editingId) {
      await update(
        entity,
        editingId,
        payload as unknown as Partial<EntityMap[typeof entity]>,
      );
      setNotice("Entry updated.");
    } else {
      await create(
        entity,
        payload as unknown as Omit<
          EntityMap[typeof entity],
          "id" | "createdAt" | "updatedAt"
        >,
      );
      setNotice("Entry added to your record.");
    }
    await refresh();
  };

  const handleDelete = async (entity: EntityName, id: string) => {
    await remove(entity, id);
    setNotice("Entry deleted.");
    await refresh();
  };

  const handleDeleteAll = async () => {
    await clearAll();
    setNotice("All local record data was deleted.");
    await refresh();
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      format: "vitals-ledger-record",
      version: 1,
      record: data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vitals-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice("JSON export downloaded.");
  };

  const handleExportPdf = () => {
    const sections = ENTITY_META.map((meta) => {
      const records = data[meta.name];
      if (records.length === 0) {
        return { heading: meta.label, lines: ["No entries recorded."] };
      }
      const lines = records.flatMap((record) => {
        const rows = describeRecord(meta.name, record);
        return rows.map((row) => `  ${row}`);
      });
      return { heading: meta.label, lines };
    });

    downloadPdf(
      {
        title: "Vitals Ledger — My Record",
        subtitle: `Exported ${formatPdfDate(Date.now())}`,
        sections,
        footer:
          "Educational record generated in the browser. Not a medical document.",
      },
      `vitals-ledger-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
    setNotice("PDF export downloaded.");
  };

  return (
    <section data-ocid="record.page" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Ledger
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          My Record
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Your observations, conditions, medications, and allergies — stored
          only in this browser.
        </p>
      </header>

      {/* Summary + actions */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-subtle">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent/15 text-accent">
              <HeartPulse aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                {totalCount}
              </p>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Entries stored
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="rounded-full border-accent/40 bg-accent/10 text-accent"
          >
            Local only
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            data-ocid="record.export_json_button"
            className="tap-target rounded-lg"
            onClick={handleExportJson}
          >
            <Download aria-hidden="true" className="size-4" />
            Export JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            data-ocid="record.export_pdf_button"
            className="tap-target rounded-lg"
            onClick={handleExportPdf}
          >
            <FileText aria-hidden="true" className="size-4" />
            Export PDF
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                data-ocid="record.delete_all_button"
                className="tap-target rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Delete all
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent
              data-ocid="record.delete_all.modal"
              className="bg-card"
            >
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">
                  Delete your entire record?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes every profile, observation,
                  condition, medication, allergy, and questionnaire stored in
                  this browser. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  data-ocid="record.delete_all.cancel_button"
                  className="tap-target rounded-lg"
                >
                  Keep my record
                </AlertDialogCancel>
                <AlertDialogAction
                  data-ocid="record.delete_all.confirm_button"
                  className="tap-target rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => void handleDeleteAll()}
                >
                  Delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {notice ? (
          <output
            data-ocid="record.success_state"
            className="block rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-foreground"
          >
            {notice}
          </output>
        ) : null}
      </div>

      {loading ? (
        <div
          data-ocid="record.loading_state"
          className="flex flex-col gap-3"
          aria-busy="true"
        >
          {Array.from({ length: 3 }, (_, i) => `record-skeleton-${i}`).map(
            (id) => (
              <div
                key={id}
                className="h-24 motion-safe:animate-pulse rounded-xl border border-border bg-muted/40"
              />
            ),
          )}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
          <div className="-mx-4 overflow-x-auto px-4">
            <TabsList
              data-ocid="record.tabs"
              className="h-auto w-max flex-nowrap gap-1 bg-muted p-1"
            >
              <TabsTrigger
                value="timeline"
                data-ocid="record.tab.timeline"
                className="tap-target rounded-lg px-3"
              >
                Timeline
              </TabsTrigger>
              <TabsTrigger
                value="trends"
                data-ocid="record.tab.trends"
                className="tap-target gap-1.5 rounded-lg px-3"
              >
                Trends
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {markerTrends.length}
                </span>
              </TabsTrigger>
              {ENTITY_META.map((meta) => (
                <TabsTrigger
                  key={meta.name}
                  value={meta.name}
                  data-ocid={`record.tab.${meta.name.toLowerCase()}`}
                  className="tap-target gap-1.5 rounded-lg px-3"
                >
                  {meta.label}
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {totals[meta.name]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Timeline */}
          <TabsContent value="timeline" className="flex flex-col gap-3">
            {timeline.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                ocid="record.timeline.empty_state"
                title="No entries yet"
                description="Add a profile, observation, or condition and it will appear here in chronological order."
              />
            ) : (
              <ol className="flex flex-col gap-3">
                {timeline.map((entry, index) => {
                  const meta = META_BY_NAME[entry.entity];
                  const Icon = meta.icon;
                  return (
                    <li
                      key={entry.key}
                      data-ocid={`record.timeline.item.${index + 1}`}
                      className="relative flex gap-3 rounded-xl border border-border bg-card p-4 shadow-subtle"
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted",
                          meta.accent,
                        )}
                      >
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate font-medium text-foreground">
                            {entry.title}
                          </p>
                          <time
                            dateTime={new Date(entry.at).toISOString()}
                            className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground"
                          >
                            {formatDateTime(entry.at)}
                          </time>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {meta.label} · {entry.detail}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </TabsContent>

          {/* Trends */}
          <TabsContent value="trends" className="flex flex-col gap-3">
            {markerTrends.length === 0 ? (
              <EmptyState
                icon={Activity}
                ocid="record.trends.empty_state"
                title="No trends yet"
                description="Add observations over time and each reading will chart how it changes, with a rising, falling or stable direction."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    data-ocid="record.trends.empty_add_button"
                    className="tap-target rounded-lg"
                    onClick={() => openAdd("Observation")}
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    Add observation
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {markerTrends.map((marker, index) => (
                  <TrendCard key={marker.key} marker={marker} index={index} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Entity tabs */}
          {ENTITY_META.map((meta) => {
            const records = data[meta.name];
            return (
              <TabsContent
                key={meta.name}
                value={meta.name}
                className="flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {records.length === 0
                      ? `No ${meta.label.toLowerCase()} yet`
                      : `${records.length} ${
                          records.length === 1 ? "entry" : "entries"
                        }`}
                  </p>
                  <Button
                    type="button"
                    data-ocid={`record.add_button.${meta.name.toLowerCase()}`}
                    className="tap-target rounded-lg"
                    onClick={() => openAdd(meta.name)}
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    Add {meta.singular}
                  </Button>
                </div>

                {records.length === 0 ? (
                  <EmptyState
                    icon={meta.icon}
                    ocid={`record.${meta.name.toLowerCase()}.empty_state`}
                    title={`No ${meta.label.toLowerCase()} recorded`}
                    description={emptyCopy(meta.name)}
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        data-ocid={`record.empty_add_button.${meta.name.toLowerCase()}`}
                        className="tap-target rounded-lg"
                        onClick={() => openAdd(meta.name)}
                      >
                        <Plus aria-hidden="true" className="size-4" />
                        Add {meta.singular}
                      </Button>
                    }
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    {records.map((record, index) => {
                      const view = describeCard(meta.name, record);
                      const marker =
                        meta.name === "Observation"
                          ? trendByMarker.get(
                              (
                                (record as Observation).code ||
                                (record as Observation).display
                              )
                                .trim()
                                .toLowerCase(),
                            )
                          : undefined;
                      return (
                        <RecordCard
                          key={record.id}
                          index={index}
                          title={view.title}
                          subtitle={view.subtitle}
                          railClass={view.railClass}
                          badge={view.badge}
                          rows={view.rows}
                          sparkline={
                            marker?.trend.hasHistory ? (
                              <TrendStrip trend={marker.trend} />
                            ) : undefined
                          }
                          onEdit={() => openEdit(meta.name, record)}
                          onDelete={() =>
                            void handleDelete(meta.name, record.id)
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {formEntity ? (
        <EntityForm
          entity={formEntity}
          open={formEntity !== null}
          editingId={editingId}
          initial={formInitial}
          onOpenChange={(open) => {
            if (!open) {
              setFormEntity(null);
              setEditingId(null);
            }
          }}
          onSubmit={handleSubmit}
        />
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Per-entity presentation                                             */
/* ------------------------------------------------------------------ */

function emptyCopy(entity: EntityName): string {
  switch (entity) {
    case "Patient":
      return "Add your name and basic details so your record has an owner.";
    case "Observation":
      return "Readings you add here — or stream from a Bluetooth device — will show up in this list.";
    case "Condition":
      return "Track ongoing or past diagnoses so your record tells the full story.";
    case "MedicationStatement":
      return "List what you take, the dose, and how often.";
    case "AllergyIntolerance":
      return "Record allergies and reactions so they are never missed.";
    case "QuestionnaireResponse":
      return "Saved symptom checks and questionnaire answers appear here.";
  }
}

interface CardView {
  title: string;
  subtitle?: string;
  railClass: string;
  badge?: ReactNode;
  rows: { label: string; value: ReactNode; mono?: boolean }[];
}

function statusBadge(label: string, tone: "success" | "warning" | "muted") {
  const toneClass =
    tone === "success"
      ? "border-success/40 bg-success/10 text-foreground"
      : tone === "warning"
        ? "border-warning/40 bg-warning/10 text-foreground"
        : "border-border bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("rounded-full", toneClass)}>
      {label}
    </Badge>
  );
}

function describeCard(
  entity: EntityName,
  record: EntityMap[EntityName],
): CardView {
  switch (entity) {
    case "Patient": {
      const r = record as Patient;
      return {
        title: r.name,
        subtitle: "Profile",
        railClass: "bg-primary",
        rows: [
          { label: "Born", value: formatDate(r.birthDate) },
          { label: "Sex", value: r.sex || "—" },
          { label: "Notes", value: r.notes || "—" },
        ],
      };
    }
    case "Observation": {
      const r = record as Observation;
      return {
        title: r.display,
        subtitle: r.code,
        railClass: r.source === "bluetooth" ? "bg-accent" : "bg-primary",
        badge:
          r.source === "bluetooth"
            ? statusBadge("Bluetooth", "success")
            : statusBadge("Manual", "muted"),
        rows: [
          {
            label: "Reading",
            value: `${r.value} ${r.unit}`,
            mono: true,
          },
          {
            label: "Measured",
            value: formatDateTime(r.effectiveAt),
            mono: true,
          },
          { label: "Notes", value: r.notes || "—" },
        ],
      };
    }
    case "Condition": {
      const r = record as Condition;
      return {
        title: r.display,
        subtitle: r.code,
        railClass:
          r.clinicalStatus === "active"
            ? "bg-warning"
            : r.clinicalStatus === "resolved"
              ? "bg-success"
              : "bg-muted-foreground",
        badge: statusBadge(
          r.clinicalStatus,
          r.clinicalStatus === "active"
            ? "warning"
            : r.clinicalStatus === "resolved"
              ? "success"
              : "muted",
        ),
        rows: [
          { label: "Onset", value: formatDate(r.onsetDate) },
          { label: "Notes", value: r.notes || "—" },
        ],
      };
    }
    case "MedicationStatement": {
      const r = record as MedicationStatement;
      return {
        title: r.medication,
        subtitle:
          [r.dose, r.frequency].filter(Boolean).join(" · ") || undefined,
        railClass: r.status === "active" ? "bg-accent" : "bg-muted-foreground",
        badge: statusBadge(
          r.status,
          r.status === "active"
            ? "success"
            : r.status === "stopped"
              ? "warning"
              : "muted",
        ),
        rows: [
          { label: "Dose", value: r.dose || "—" },
          { label: "Frequency", value: r.frequency || "—" },
          { label: "Started", value: formatDate(r.startedAt) },
          { label: "Notes", value: r.notes || "—" },
        ],
      };
    }
    case "AllergyIntolerance": {
      const r = record as AllergyIntolerance;
      return {
        title: r.substance,
        subtitle: r.reaction || undefined,
        railClass:
          r.severity === "severe"
            ? "bg-destructive"
            : r.severity === "moderate"
              ? "bg-warning"
              : "bg-success",
        badge: statusBadge(
          r.severity,
          r.severity === "severe"
            ? "warning"
            : r.severity === "moderate"
              ? "warning"
              : "success",
        ),
        rows: [
          { label: "Reaction", value: r.reaction || "—" },
          { label: "Notes", value: r.notes || "—" },
        ],
      };
    }
    case "QuestionnaireResponse": {
      const r = record as QuestionnaireResponse;
      const answers = Object.entries(r.answers);
      return {
        title: r.questionnaire,
        subtitle: `${answers.length} ${
          answers.length === 1 ? "answer" : "answers"
        }`,
        railClass: "bg-primary",
        rows: [
          {
            label: "Completed",
            value: formatDateTime(r.completedAt),
            mono: true,
          },
          {
            label: "Answers",
            value:
              answers.length === 0
                ? "—"
                : answers.map(([k, v]) => `${k}: ${v}`).join("; "),
          },
        ],
      };
    }
  }
}

/** Flatten a record into PDF text lines. */
function describeRecord(
  entity: EntityName,
  record: EntityMap[EntityName],
): string[] {
  const view = describeCard(entity, record);
  const lines = [view.title];
  if (view.subtitle) lines.push(`  ${view.subtitle}`);
  for (const row of view.rows) {
    const value =
      typeof row.value === "string" || typeof row.value === "number"
        ? String(row.value)
        : "";
    lines.push(`  ${row.label}: ${value}`);
  }
  return lines;
}

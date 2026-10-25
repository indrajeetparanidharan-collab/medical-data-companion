import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { create } from "@/lib/db";
import { EMERGENCY_NUMBER, emergencyTelHref } from "@/lib/emergency";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Phone,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { useMemo, useState } from "react";

interface Symptom {
  id: string;
  label: string;
  group: string;
  redFlag?: boolean;
}

interface Condition {
  id: string;
  name: string;
  explanation: string;
  nextSteps: string;
  /** Symptom ids that support this condition. */
  matches: string[];
}

const SYMPTOMS: Symptom[] = [
  {
    id: "chest_pain",
    label: "Chest pain or pressure",
    group: "Chest",
    redFlag: true,
  },
  {
    id: "shortness_of_breath",
    label: "Shortness of breath",
    group: "Chest",
    redFlag: true,
  },
  {
    id: "severe_bleeding",
    label: "Severe or uncontrolled bleeding",
    group: "Emergency",
    redFlag: true,
  },
  {
    id: "sudden_weakness",
    label: "Sudden weakness or numbness on one side",
    group: "Emergency",
    redFlag: true,
  },
  {
    id: "confusion",
    label: "New confusion or trouble speaking",
    group: "Emergency",
    redFlag: true,
  },
  {
    id: "suicidal_ideation",
    label: "Thoughts of harming yourself",
    group: "Emergency",
    redFlag: true,
  },
  { id: "cough", label: "Cough", group: "Respiratory" },
  { id: "sore_throat", label: "Sore throat", group: "Respiratory" },
  { id: "runny_nose", label: "Runny or stuffy nose", group: "Respiratory" },
  { id: "wheezing", label: "Wheezing", group: "Respiratory" },
  { id: "fever", label: "Fever", group: "General" },
  { id: "fatigue", label: "Tiredness or fatigue", group: "General" },
  { id: "body_aches", label: "Body aches", group: "General" },
  { id: "chills", label: "Chills", group: "General" },
  { id: "headache", label: "Headache", group: "Head" },
  { id: "dizziness", label: "Dizziness or lightheadedness", group: "Head" },
  { id: "nausea", label: "Nausea or vomiting", group: "Digestive" },
  { id: "diarrhea", label: "Diarrhea", group: "Digestive" },
  { id: "abdominal_pain", label: "Stomach pain", group: "Digestive" },
  { id: "heartburn", label: "Heartburn or acid reflux", group: "Digestive" },
  {
    id: "joint_pain",
    label: "Joint pain or swelling",
    group: "Muscles & joints",
  },
  { id: "muscle_pain", label: "Muscle pain", group: "Muscles & joints" },
  { id: "rash", label: "Skin rash", group: "Skin" },
  { id: "itchy_eyes", label: "Itchy or watery eyes", group: "Skin" },
  { id: "sneezing", label: "Sneezing", group: "Skin" },
  {
    id: "frequent_urination",
    label: "Urinating more often than usual",
    group: "Urinary",
  },
  {
    id: "burning_urination",
    label: "Burning when urinating",
    group: "Urinary",
  },
  { id: "thirst", label: "Unusual thirst", group: "Urinary" },
  { id: "palpitations", label: "Racing or pounding heartbeat", group: "Heart" },
  {
    id: "swollen_legs",
    label: "Swelling in the legs or ankles",
    group: "Heart",
  },
];

const CONDITIONS: Condition[] = [
  {
    id: "common_cold",
    name: "Common cold",
    explanation:
      "A mild viral infection of the nose and throat. It usually clears up on its own within a week to ten days.",
    nextSteps:
      "Rest, drink fluids, and use simple over-the-counter relief if needed.",
    matches: [
      "runny_nose",
      "sneezing",
      "sore_throat",
      "cough",
      "headache",
      "fatigue",
    ],
  },
  {
    id: "influenza",
    name: "Influenza (flu)",
    explanation:
      "A viral infection that tends to come on quickly with fever, aches, and tiredness. It is usually worse than a cold.",
    nextSteps:
      "Rest and fluids. Seek care if symptoms are severe or you are in a higher-risk group.",
    matches: [
      "fever",
      "chills",
      "body_aches",
      "fatigue",
      "headache",
      "cough",
      "sore_throat",
    ],
  },
  {
    id: "allergic_rhinitis",
    name: "Allergic rhinitis (hay fever)",
    explanation:
      "An allergic reaction to pollen, dust, or pets that irritates the nose and eyes. It is not contagious.",
    nextSteps: "Reduce exposure to triggers and consider an antihistamine.",
    matches: ["sneezing", "runny_nose", "itchy_eyes", "cough"],
  },
  {
    id: "asthma",
    name: "Asthma flare",
    explanation:
      "Narrowing of the airways that causes wheezing, cough, and a tight chest. It can be triggered by allergens, cold air, or exercise.",
    nextSteps:
      "Use your reliever inhaler as prescribed and follow your asthma action plan.",
    matches: ["wheezing", "shortness_of_breath", "cough", "chest_pain"],
  },
  {
    id: "gastroenteritis",
    name: "Stomach bug (gastroenteritis)",
    explanation:
      "An infection of the gut that causes nausea, diarrhea, and stomach cramps. It usually settles within a few days.",
    nextSteps: "Replace fluids and watch for signs of dehydration.",
    matches: ["nausea", "diarrhea", "abdominal_pain", "fever", "body_aches"],
  },
  {
    id: "gerd",
    name: "Acid reflux (GERD)",
    explanation:
      "Stomach acid flowing back into the food pipe, causing burning behind the breastbone and an acid taste.",
    nextSteps:
      "Eat smaller meals, avoid late eating, and discuss antacids with a pharmacist.",
    matches: ["heartburn", "abdominal_pain", "nausea", "cough"],
  },
  {
    id: "migraine",
    name: "Migraine",
    explanation:
      "A recurring headache, often one-sided and throbbing, sometimes with nausea and sensitivity to light.",
    nextSteps:
      "Rest in a dark, quiet room and use your usual migraine treatment.",
    matches: ["headache", "nausea", "dizziness", "fatigue"],
  },
  {
    id: "uti",
    name: "Urinary tract infection",
    explanation:
      "An infection in the bladder or urinary tract that causes burning and a frequent urge to urinate.",
    nextSteps:
      "Drink fluids and speak to a clinician, as antibiotics are often needed.",
    matches: [
      "burning_urination",
      "frequent_urination",
      "abdominal_pain",
      "fever",
    ],
  },
  {
    id: "type2_diabetes",
    name: "High blood sugar (type 2 diabetes)",
    explanation:
      "The body struggles to use sugar for energy, which can cause thirst, frequent urination, and tiredness over time.",
    nextSteps: "Ask a clinician about a blood sugar test.",
    matches: ["thirst", "frequent_urination", "fatigue"],
  },
  {
    id: "anemia",
    name: "Low iron (anemia)",
    explanation:
      "Not enough healthy red blood cells to carry oxygen, which can leave you tired, pale, and short of breath.",
    nextSteps: "Ask a clinician about a simple blood test.",
    matches: ["fatigue", "dizziness", "shortness_of_breath", "palpitations"],
  },
  {
    id: "heart_failure",
    name: "Heart failure",
    explanation:
      "The heart pumps less effectively, so fluid can build up and cause swelling, breathlessness, and tiredness.",
    nextSteps: "See a clinician promptly for assessment.",
    matches: ["swollen_legs", "shortness_of_breath", "fatigue", "palpitations"],
  },
  {
    id: "arrhythmia",
    name: "Heart rhythm change (arrhythmia)",
    explanation:
      "The heart beats too fast, too slow, or unevenly, which can feel like a racing or fluttering heartbeat.",
    nextSteps: "Discuss ongoing palpitations with a clinician.",
    matches: ["palpitations", "dizziness", "shortness_of_breath", "chest_pain"],
  },
  {
    id: "arthritis",
    name: "Arthritis",
    explanation:
      "Inflammation of the joints that causes pain, stiffness, and swelling, often worse in the morning.",
    nextSteps:
      "Keep moving gently and discuss pain relief with a pharmacist or clinician.",
    matches: ["joint_pain", "muscle_pain", "fatigue"],
  },
  {
    id: "viral_rash",
    name: "Viral rash",
    explanation:
      "Many viral illnesses cause a temporary skin rash alongside fever or aches. It usually fades as the illness passes.",
    nextSteps: "Keep the skin cool and monitor for spreading or worsening.",
    matches: ["rash", "fever", "body_aches", "fatigue"],
  },
  {
    id: "dehydration",
    name: "Dehydration",
    explanation:
      "The body has lost more fluid than it has taken in, which can cause dizziness, thirst, and tiredness.",
    nextSteps: "Drink fluids steadily and rest.",
    matches: ["dizziness", "thirst", "fatigue", "nausea", "headache"],
  },
];

const RED_FLAG_SYMPTOMS = SYMPTOMS.filter((s) => s.redFlag);

function scoreConditions(selected: Set<string>): Condition[] {
  const scored = CONDITIONS.map((condition) => {
    const hits = condition.matches.filter((id) => selected.has(id)).length;
    const coverage = hits / condition.matches.length;
    return { condition, hits, score: hits + coverage };
  })
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.score - a.score || b.hits - a.hits);

  return scored.slice(0, 5).map((entry) => entry.condition);
}

export default function SymptomsPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SYMPTOMS;
    return SYMPTOMS.filter((s) => s.label.toLowerCase().includes(q));
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Symptom[]>();
    for (const symptom of filtered) {
      const bucket = map.get(symptom.group);
      if (bucket) bucket.push(symptom);
      else map.set(symptom.group, [symptom]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const activeRedFlags = useMemo(
    () => RED_FLAG_SYMPTOMS.filter((s) => selected.has(s.id)),
    [selected],
  );
  const hasRedFlag = activeRedFlags.length > 0;

  const ranked = useMemo(
    () => (hasRedFlag ? [] : scoreConditions(selected)),
    [hasRedFlag, selected],
  );

  function toggle(id: string) {
    setSaveState("idle");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setSelected(new Set());
    setQuery("");
    setSaveState("idle");
  }

  async function saveToRecord() {
    if (selected.size === 0) return;
    setSaveState("saving");
    const chosen = SYMPTOMS.filter((s) => selected.has(s.id));
    const answers: Record<string, string> = {
      "symptom-count": String(chosen.length),
      "red-flag": hasRedFlag ? "yes" : "no",
    };
    chosen.forEach((symptom, index) => {
      answers[`symptom-${index + 1}`] = symptom.label;
    });
    try {
      await create("QuestionnaireResponse", {
        questionnaire: "Symptom checker",
        answers,
        completedAt: Date.now(),
      });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <section data-ocid="symptoms.page" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Checker
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Symptoms
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Pick the symptoms you notice. We will show a short educational list of
          what they can be linked to — never a diagnosis.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/60 p-4">
        <ShieldCheck
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-accent"
        />
        <p className="text-sm leading-relaxed text-secondary-foreground">
          This checker is for learning only. It cannot diagnose you. Always
          speak to a qualified clinician about your health.
        </p>
      </div>

      {hasRedFlag ? (
        <div
          data-ocid="symptoms.emergency_state"
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
                You selected{" "}
                <span className="font-semibold">
                  {activeRedFlags.map((s) => s.label).join(", ")}
                </span>
                . These can be signs of a life-threatening emergency. Stop and
                call for help right away.
              </p>
            </div>
          </div>
          <a
            href={emergencyTelHref()}
            data-ocid="symptoms.emergency_call_button"
            className="tap-target inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-5 text-base font-semibold text-destructive-foreground transition-smooth hover:opacity-90"
          >
            <Phone aria-hidden="true" className="size-5" />
            Call {EMERGENCY_NUMBER}
          </a>
          <p className="text-xs text-muted-foreground">
            No condition list is shown while an emergency sign is selected.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-subtle">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="symptom-search"
            className="text-sm font-semibold text-foreground"
          >
            Search symptoms
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="symptom-search"
              type="search"
              data-ocid="symptoms.search_input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. cough, headache, rash"
              className="tap-target pl-9"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {selected.size === 0
              ? "No symptoms selected yet"
              : `${selected.size} selected`}
          </p>
          {selected.size > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-ocid="symptoms.reset_button"
              onClick={reset}
              className="tap-target rounded-lg"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Clear
            </Button>
          ) : null}
        </div>

        {grouped.length === 0 ? (
          <p
            data-ocid="symptoms.empty_state"
            className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground"
          >
            No symptoms match “{query}”. Try a different word.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {grouped.map(([group, items]) => (
              <fieldset key={group} className="flex flex-col gap-2">
                <legend className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {group}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {items.map((symptom) => {
                    const isOn = selected.has(symptom.id);
                    return (
                      <button
                        key={symptom.id}
                        type="button"
                        data-ocid={`symptoms.option.${symptom.id}`}
                        aria-pressed={isOn}
                        onClick={() => toggle(symptom.id)}
                        className={cn(
                          "tap-target inline-flex items-center gap-2 rounded-full border px-4 text-sm font-medium transition-smooth",
                          isOn
                            ? symptom.redFlag
                              ? "border-destructive bg-destructive text-destructive-foreground"
                              : "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-secondary",
                        )}
                      >
                        {isOn ? (
                          <Check aria-hidden="true" className="size-4" />
                        ) : null}
                        {symptom.label}
                        {symptom.redFlag ? (
                          <AlertTriangle
                            aria-hidden="true"
                            className="size-3.5"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        )}
      </div>

      {!hasRedFlag && selected.size > 0 ? (
        <div
          data-ocid="symptoms.results_section"
          className="flex flex-col gap-4"
        >
          <div className="flex items-center gap-2">
            <Stethoscope aria-hidden="true" className="size-5 text-primary" />
            <h2 className="font-display text-xl font-bold tracking-tight">
              Possible links
            </h2>
          </div>

          {ranked.length === 0 ? (
            <p
              data-ocid="symptoms.results_empty_state"
              className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground"
            >
              We could not match those symptoms to anything in our short
              educational list. That does not mean nothing is wrong — please
              speak to a clinician if you are worried.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {ranked.map((condition, index) => (
                <li
                  key={condition.id}
                  data-ocid={`symptoms.result.${index + 1}`}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-subtle"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-lg font-semibold text-foreground">
                      {condition.name}
                    </h3>
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
                  <p className="text-sm leading-relaxed text-foreground">
                    <span className="font-semibold">What you can do: </span>
                    {condition.nextSteps}
                  </p>
                </li>
              ))}
            </ol>
          )}

          <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/60 p-4">
            <BookOpen
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-accent"
            />
            <p className="text-sm leading-relaxed text-secondary-foreground">
              This list is educational and ranked by how many of your selected
              symptoms it shares. It is not a diagnosis and does not replace
              professional medical advice.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-subtle">
        <Button
          type="button"
          data-ocid="symptoms.save_button"
          onClick={saveToRecord}
          disabled={selected.size === 0 || saveState === "saving"}
          className="tap-target w-full rounded-lg"
        >
          <Save aria-hidden="true" className="size-4" />
          {saveState === "saving" ? "Saving…" : "Save to my record"}
        </Button>
        {selected.size === 0 ? (
          <p className="text-xs text-muted-foreground">
            Select at least one symptom to save.
          </p>
        ) : null}
        {saveState === "saved" ? (
          <output
            data-ocid="symptoms.save_success_state"
            className="text-sm font-medium text-success"
          >
            Saved to your record.
          </output>
        ) : null}
        {saveState === "error" ? (
          <p
            data-ocid="symptoms.save_error_state"
            role="alert"
            className="text-sm font-medium text-destructive"
          >
            Could not save. Please try again.
          </p>
        ) : null}
      </div>
    </section>
  );
}

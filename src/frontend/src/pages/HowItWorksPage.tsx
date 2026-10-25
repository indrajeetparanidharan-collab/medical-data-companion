import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Activity,
  BookOpen,
  ExternalLink,
  Gauge,
  HeartPulse,
  Info,
  ListChecks,
  ShieldAlert,
} from "lucide-react";

/** Name and version of the prediction model documented on this page. */
const MODEL_NAME = "Framingham General CVD Risk Profile";
const MODEL_VERSION = "D'Agostino et al., Circulation 2008;117:743-753";

interface ModelInput {
  name: string;
  unit: string;
  source: string;
  why: string;
}

/** The inputs the Framingham General CVD model reads. */
const MODEL_INPUTS: ModelInput[] = [
  {
    name: "Age",
    unit: "years",
    source: "Entered on the Predict screen",
    why: "Entered as a logarithm in the model. Risk rises with age, so older ages carry a higher baseline.",
  },
  {
    name: "Sex",
    unit: "female / male",
    source: "Entered on the Predict screen",
    why: "The published model has separate coefficient sets for women and men, so sex selects which set is used.",
  },
  {
    name: "Total cholesterol",
    unit: "mg/dL",
    source: "Entered on the Predict screen",
    why: "Entered as a logarithm. Higher total cholesterol raises the estimate.",
  },
  {
    name: "HDL cholesterol",
    unit: "mg/dL",
    source: "Entered on the Predict screen",
    why: "Entered as a logarithm with a negative coefficient, so higher HDL lowers the estimate.",
  },
  {
    name: "Systolic blood pressure",
    unit: "mm Hg",
    source: "Entered on the Predict screen, or filled from a connected cuff",
    why: "Entered as a logarithm. The model uses a different coefficient depending on whether blood pressure is treated.",
  },
  {
    name: "Blood-pressure treatment",
    unit: "yes / no",
    source: "Entered on the Predict screen",
    why: "Selects the treated or untreated systolic coefficient, matching the published model.",
  },
  {
    name: "Current smoker",
    unit: "yes / no",
    source: "Entered on the Predict screen",
    why: "Adds a fixed coefficient to the linear predictor when you currently smoke.",
  },
  {
    name: "Diabetes",
    unit: "yes / no",
    source: "Entered on the Predict screen",
    why: "Adds a fixed coefficient to the linear predictor when you have diabetes.",
  },
];

interface Band {
  label: "Low" | "Moderate" | "High";
  range: string;
  tone: string;
  meaning: string;
}

/** The three risk bands the gauge uses, keyed to the 10-year risk percentage. */
const BANDS: Band[] = [
  {
    label: "Low",
    range: "under 10%",
    tone: "bg-success/15 text-success-foreground border-success/40",
    meaning:
      "Your 10-year risk of a cardiovascular event is under 10 percent. Keep up the habits that are working.",
  },
  {
    label: "Moderate",
    range: "10% to under 20%",
    tone: "bg-warning/20 text-warning-foreground border-warning/50",
    meaning:
      "Your 10-year risk is between 10 and 20 percent. Small, steady changes can lower it.",
  },
  {
    label: "High",
    range: "20% or more",
    tone: "bg-destructive/15 text-destructive border-destructive/40",
    meaning:
      "Your 10-year risk is 20 percent or more. Please discuss these results with a clinician soon.",
  },
];

interface Citation {
  label: string;
  detail: string;
  href: string;
}

/** Published sources the model is taken from. */
const CITATIONS: Citation[] = [
  {
    label:
      "D'Agostino RB Sr, et al. General cardiovascular risk profile for use in primary care: the Framingham Heart Study. Circulation. 2008;117(6):743-753.",
    detail:
      "The published source of the model. Its Table 2 supplies the sex-specific Cox regression coefficients and the 10-year baseline survival values used here.",
    href: "https://doi.org/10.1161/CIRCULATIONAHA.107.699579",
  },
  {
    label: "PubMed record — PMID 18212285",
    detail:
      "The indexed citation for the paper above, for reference and verification.",
    href: "https://pubmed.ncbi.nlm.nih.gov/18212285/",
  },
];

/** One model input, shown as a labelled row. */
function InputRow({ input }: { input: ModelInput }) {
  return (
    <li className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-medium text-foreground">{input.name}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {input.unit}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {input.why}
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-widest">Source</span>{" "}
        {input.source}
      </p>
    </li>
  );
}

/** How It Works screen: documents the prediction model, its inputs, bands, and sources. */
export default function HowItWorksPage() {
  return (
    <section
      data-ocid="how_it_works.page"
      className="flex flex-col gap-6"
      aria-labelledby="how-it-works-heading"
    >
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Method
        </p>
        <h1
          id="how-it-works-heading"
          className="font-display text-3xl font-bold tracking-tight"
        >
          How It Works
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Every estimate this app shows comes from one published model that runs
          entirely in your browser. Here is exactly what it reads, how it
          scores, and where its numbers come from.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="secondary" data-ocid="how_it_works.version_badge">
            {MODEL_NAME}
          </Badge>
          <Badge variant="outline" data-ocid="how_it_works.runs_locally_badge">
            Runs on your device
          </Badge>
        </div>
      </header>

      <Card
        data-ocid="how_it_works.disclaimer_card"
        className="border-warning/40 bg-warning/10 shadow-none"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert
              aria-hidden="true"
              className="size-5 text-warning-foreground"
            />
            Educational tool — not medical advice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground">
            This estimate is a teaching aid, not a diagnosis. It cannot detect,
            rule out, or confirm any condition, and it does not replace a
            clinician. Never change medication or delay care based on this
            number. If you feel unwell or think you are having an emergency,
            call your local emergency number right away.
          </p>
        </CardContent>
      </Card>

      <Card data-ocid="how_it_works.model_card" className="shadow-subtle">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gauge aria-hidden="true" className="size-5 text-primary" />
            The prediction model
          </CardTitle>
          <CardDescription>
            The Framingham General CVD Risk Profile — a published Cox model that
            estimates 10-year cardiovascular risk.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            The app applies the sex-specific Cox regression model from the
            Framingham Heart Study exactly as published. It is not a
            machine-learning black box: the coefficients are fixed and visible,
            so the same inputs always produce the same estimate.
          </p>
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="font-mono text-xs leading-relaxed text-foreground">
              risk = 1 − S₀(10) ^ exp(ΣβX − ΣβX̄)
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold">ΣβX</span> is the sum of each
              input multiplied by its published coefficient.{" "}
              <span className="font-semibold">ΣβX̄</span> is the model's
              reference mean, which centers the result.{" "}
              <span className="font-semibold">S₀(10)</span> is the 10-year
              baseline survival. The result is the 10-year risk, shown as a
              percentage.
            </p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Model version: {MODEL_VERSION}.
          </p>
        </CardContent>
      </Card>

      <Card data-ocid="how_it_works.inputs_card" className="shadow-subtle">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListChecks aria-hidden="true" className="size-5 text-primary" />
            What the model needs
          </CardTitle>
          <CardDescription>
            Eight inputs, all entered on the Predict screen. Nothing is sent
            anywhere.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul data-ocid="how_it_works.inputs_list" className="flex flex-col">
            {MODEL_INPUTS.map((input) => (
              <InputRow key={input.name} input={input} />
            ))}
          </ul>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              The model is validated for ages 30 to 74. If a value is missing or
              out of range, the form asks you to correct it before calculating.
            </span>
          </p>
        </CardContent>
      </Card>

      <Card data-ocid="how_it_works.bands_card" className="shadow-subtle">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HeartPulse aria-hidden="true" className="size-5 text-primary" />
            How the bands are set
          </CardTitle>
          <CardDescription>
            The 10-year risk percentage is split into three plain-language
            bands.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {BANDS.map((band) => (
            <div
              key={band.label}
              data-ocid={`how_it_works.band.${band.label.toLowerCase()}`}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-4",
                band.tone,
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-display text-base font-bold">
                  {band.label}
                </span>
                <span className="font-mono text-xs">risk {band.range}</span>
              </div>
              <p className="text-sm leading-relaxed">{band.meaning}</p>
            </div>
          ))}
          <p className="text-xs leading-relaxed text-muted-foreground">
            The cut-offs are fixed at 10 percent and 20 percent, matching the
            bands the gauge uses. They are a teaching convention, not a clinical
            threshold.
          </p>
        </CardContent>
      </Card>

      <Card data-ocid="how_it_works.sources_card" className="shadow-subtle">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen aria-hidden="true" className="size-5 text-primary" />
            Published sources
          </CardTitle>
          <CardDescription>
            The paper the model and its coefficients are taken from.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul data-ocid="how_it_works.sources_list" className="flex flex-col">
            {CITATIONS.map((citation) => (
              <li
                key={citation.href}
                className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0"
              >
                <a
                  href={citation.href}
                  target="_blank"
                  rel="noreferrer"
                  data-ocid="how_it_works.source_link"
                  className="inline-flex items-start gap-1.5 font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  <span>{citation.label}</span>
                  <ExternalLink
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0"
                  />
                </a>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {citation.detail}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card data-ocid="how_it_works.faq_card" className="shadow-subtle">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity aria-hidden="true" className="size-5 text-primary" />
            Common questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="accuracy">
              <AccordionTrigger data-ocid="how_it_works.faq.accuracy">
                How accurate is the estimate?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                It is a population-level estimate, not a measurement. It
                reflects only the values you enter, so gaps or typos change the
                result. Treat it as a prompt to look at your numbers, never as a
                verdict.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="privacy">
              <AccordionTrigger data-ocid="how_it_works.faq.privacy">
                Where does my data go?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Nowhere. The model runs in your browser and your values stay on
                this device. There is no server, no account, and no tracking.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="updates">
              <AccordionTrigger data-ocid="how_it_works.faq.updates">
                Can the model change?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The model is fixed to the published source shown above. If the
                implementation ever changes, the model version on this page
                changes with it, so you can always tell which version produced
                an estimate.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </section>
  );
}

import { renderWithActor } from "@/__tests__/test-utils";
import type { EntityName } from "@/lib/db";
import { EMERGENCY_NUMBER } from "@/lib/emergency";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cover for the Analyze Labs feature: blood-marker panels with unit toggles and
 * cited range indicators, the client-side rule engine, the red-flag emergency
 * stop, auto-save to the record, and trend sparklines. The in-memory store
 * mirrors the real `@/lib/db` public contract and returns fresh snapshots so the
 * UI never aliases state.
 */
const store = vi.hoisted(() => {
  const data: Record<string, Record<string, unknown>[]> = {
    Patient: [],
    Observation: [],
    Condition: [],
    MedicationStatement: [],
    AllergyIntolerance: [],
    QuestionnaireResponse: [],
  };
  let counter = 0;
  return {
    data,
    reset() {
      for (const key of Object.keys(data)) data[key] = [];
      counter = 0;
    },
    nextId() {
      counter += 1;
      return `id-${counter}`;
    },
  };
});

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    create: vi.fn(
      async (entity: EntityName, record: Record<string, unknown>) => {
        const now = Date.now();
        const full = {
          ...record,
          id: store.nextId(),
          createdAt: now,
          updatedAt: now,
        };
        store.data[entity].push(full);
        return structuredClone(full);
      },
    ),
    list: vi.fn(async (entity: EntityName) =>
      structuredClone(store.data[entity]),
    ),
    update: vi.fn(
      async (
        entity: EntityName,
        id: string,
        changes: Record<string, unknown>,
      ) => {
        const existing = store.data[entity].find((r) => r.id === id);
        if (!existing) throw new Error(`${entity} ${id} not found`);
        Object.assign(existing, changes, { id, updatedAt: Date.now() });
        return structuredClone(existing);
      },
    ),
    remove: vi.fn(async (entity: EntityName, id: string) => {
      store.data[entity] = store.data[entity].filter((r) => r.id !== id);
    }),
    clearAll: vi.fn(async () => {
      for (const key of Object.keys(store.data)) store.data[key] = [];
    }),
  };
});

import App from "@/App";
import AnalyzeLabsPage from "@/pages/AnalyzeLabsPage";
import PredictPage from "@/pages/PredictPage";
import RecordPage from "@/pages/RecordPage";

const emptyActor = {} as never;

beforeEach(() => {
  store.reset();
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Type a value into a marker input on the Analyze Labs page. */
async function enterMarker(
  user: ReturnType<typeof userEvent.setup>,
  markerId: string,
  value: string,
) {
  const input = await screen.findByTestId(`analyze_labs.input.${markerId}`);
  await user.clear(input);
  await user.type(input, value);
}

describe("Analyze Labs: navigation and blood-marker panels", () => {
  it("appears in the navigation and opens a page with blood-marker input panels", async () => {
    const user = userEvent.setup();
    renderWithActor(<App />, emptyActor);

    await screen.findByTestId("home.page");
    await user.click(screen.getByTestId("nav.link.analyze_labs"));

    expect(await screen.findByTestId("analyze_labs.page")).toBeInTheDocument();
    expect(
      screen.getByTestId("analyze_labs.marker.fasting_glucose"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("analyze_labs.marker.total_cholesterol"),
    ).toBeInTheDocument();
    // The persistent disclaimer banner stays visible on the new page.
    expect(screen.getByTestId("disclaimer.banner")).toBeInTheDocument();
  });

  it("shows an amber out-of-range indicator with the cited range for glucose 110 mg/dL", async () => {
    const user = userEvent.setup();
    renderWithActor(<AnalyzeLabsPage />, emptyActor);

    await enterMarker(user, "fasting_glucose", "110");

    const indicator = await screen.findByTestId(
      "analyze_labs.indicator.fasting_glucose",
    );
    expect(indicator).toHaveTextContent(/mildly out of range/i);

    const marker = screen.getByTestId("analyze_labs.marker.fasting_glucose");
    expect(marker).toHaveTextContent(/70–99 mg\/dL/);
    expect(marker).toHaveTextContent(/WHO/);
  });

  it("converts the displayed value when the unit is toggled to mmol/L", async () => {
    const user = userEvent.setup();
    renderWithActor(<AnalyzeLabsPage />, emptyActor);

    await enterMarker(user, "fasting_glucose", "110");
    await user.click(
      screen.getByTestId("analyze_labs.unit.fasting_glucose.mmol/L"),
    );

    // Toggling the unit converts the displayed value in place: 110 mg/dL
    // becomes 110 / 18.02 = 6.1 mmol/L, the same physical quantity.
    expect(
      screen.getByTestId("analyze_labs.input.fasting_glucose"),
    ).toHaveValue(6.1);

    await user.click(screen.getByTestId("analyze_labs.analyze_button"));

    const flag = await screen.findByTestId("analyze_labs.flag.fasting_glucose");
    // 6.1 mmol/L converts back to 6.1 * 18.02 = 109.922 mg/dL, still mildly
    // out of range, so the flag is unchanged by the unit switch.
    expect(flag).toHaveTextContent("109.922 mg/dL");
    expect(flag).toHaveTextContent(/mildly out of range/i);
  });
});

describe("Analyze Labs: red-flag emergency stop", () => {
  it("stops with the emergency banner and call link for systolic 185 and diastolic 125", async () => {
    const user = userEvent.setup();
    renderWithActor(<AnalyzeLabsPage />, emptyActor);

    await enterMarker(user, "systolic_bp", "185");
    await enterMarker(user, "diastolic_bp", "125");
    await user.click(screen.getByTestId("analyze_labs.analyze_button"));

    const emergency = await screen.findByTestId("analyze_labs.emergency_state");
    expect(emergency).toHaveTextContent(/Get emergency help now/i);
    expect(
      within(emergency).getByTestId("analyze_labs.emergency_call_button"),
    ).toHaveAttribute("href", `tel:${EMERGENCY_NUMBER}`);
    // The critical values are named in the red-flag reasons.
    expect(emergency).toHaveTextContent(/Systolic blood pressure/);
    expect(emergency).toHaveTextContent(/Diastolic blood pressure/);
  });

  it("stops with the emergency banner for glucose 320 mg/dL", async () => {
    const user = userEvent.setup();
    renderWithActor(<AnalyzeLabsPage />, emptyActor);

    await enterMarker(user, "fasting_glucose", "320");
    await user.click(screen.getByTestId("analyze_labs.analyze_button"));

    expect(
      await screen.findByTestId("analyze_labs.emergency_state"),
    ).toHaveTextContent(/Get emergency help now/i);
  });

  it("stops with the emergency banner for SpO2 85%", async () => {
    const user = userEvent.setup();
    renderWithActor(<AnalyzeLabsPage />, emptyActor);

    await enterMarker(user, "spo2", "85");
    await user.click(screen.getByTestId("analyze_labs.analyze_button"));

    expect(
      await screen.findByTestId("analyze_labs.emergency_state"),
    ).toHaveTextContent(/Get emergency help now/i);
  });
});

describe("Analyze Labs: ranked conditions and citations", () => {
  it("ranks three to five conditions naming the contributing values for a metabolic pattern", async () => {
    const user = userEvent.setup();
    renderWithActor(<AnalyzeLabsPage />, emptyActor);

    await enterMarker(user, "systolic_bp", "150");
    await enterMarker(user, "fasting_glucose", "140");
    await enterMarker(user, "triglycerides", "220");
    await user.click(screen.getByTestId("analyze_labs.analyze_button"));

    const results = await screen.findByTestId("analyze_labs.results_section");
    const ranked = within(results).getAllByTestId(
      /^analyze_labs\.result\.\d+$/,
    );
    expect(ranked.length).toBeGreaterThanOrEqual(3);
    expect(ranked.length).toBeLessThanOrEqual(5);

    // The metabolic-syndrome pattern names its contributing values.
    const metabolic = ranked.find((item) =>
      /metabolic syndrome/i.test(item.textContent ?? ""),
    );
    expect(metabolic).toBeDefined();
    expect(metabolic).toHaveTextContent(/Fasting glucose: 140 mg\/dL/);
    expect(metabolic).toHaveTextContent(/Triglycerides: 220 mg\/dL/);

    // Every ranked condition carries a WHO/NICE/AHA citation.
    for (const item of ranked) {
      expect(item).toHaveTextContent(/Source: (WHO|NICE|AHA)/);
    }
  });

  it("shows the not-a-diagnosis note on the results view", async () => {
    const user = userEvent.setup();
    renderWithActor(<AnalyzeLabsPage />, emptyActor);

    await enterMarker(user, "fasting_glucose", "110");
    await user.click(screen.getByTestId("analyze_labs.analyze_button"));

    const results = await screen.findByTestId("analyze_labs.results_section");
    expect(results).toHaveTextContent(/not a diagnosis/i);
  });
});

describe("Analyze Labs: auto-save to the Patient Record", () => {
  it("saves entered values as timestamped Observations and ranked conditions as Conditions", async () => {
    const user = userEvent.setup();
    renderWithActor(<AnalyzeLabsPage />, emptyActor);

    await enterMarker(user, "fasting_glucose", "140");
    await enterMarker(user, "triglycerides", "220");
    await user.click(screen.getByTestId("analyze_labs.analyze_button"));

    await screen.findByTestId("analyze_labs.results_section");
    await user.click(screen.getByTestId("analyze_labs.save_button"));

    expect(
      await screen.findByTestId("analyze_labs.save_success_state"),
    ).toHaveTextContent(/saved to your record/i);

    const observations = store.data.Observation;
    expect(observations).toHaveLength(2);
    for (const obs of observations) {
      expect(obs).toMatchObject({ source: "manual" });
      expect(typeof obs.effectiveAt).toBe("number");
    }
    expect(observations.map((o) => o.code)).toEqual(
      expect.arrayContaining(["fasting_glucose", "triglycerides"]),
    );

    expect(store.data.Condition.length).toBeGreaterThanOrEqual(1);
    expect(store.data.Condition[0]).toMatchObject({ clinicalStatus: "active" });
  });
});

describe("Analyze Labs: trends versus previous readings", () => {
  it("shows a sparkline and direction arrow for a second reading of the same marker", async () => {
    store.data.Observation.push({
      id: "obs-1",
      code: "fasting_glucose",
      display: "Fasting glucose",
      value: 100,
      unit: "mg/dL",
      effectiveAt: Date.now() - 86_400_000,
      source: "manual",
      createdAt: 1,
      updatedAt: 1,
    });

    const user = userEvent.setup();
    renderWithActor(<AnalyzeLabsPage />, emptyActor);

    await enterMarker(user, "fasting_glucose", "140");

    const trend = await screen.findByTestId(
      "analyze_labs.trend.fasting_glucose",
    );
    expect(trend).toHaveTextContent(/rising/i);
    const marker = screen.getByTestId("analyze_labs.marker.fasting_glucose");
    expect(marker.querySelector("svg")).not.toBeNull();
  });
});

describe("Patient Record: trend charts", () => {
  it("displays trend charts for recorded Observations", async () => {
    const now = Date.now();
    store.data.Observation.push(
      {
        id: "o1",
        code: "fasting_glucose",
        display: "Fasting glucose",
        value: 100,
        unit: "mg/dL",
        effectiveAt: now - 172_800_000,
        source: "manual",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "o2",
        code: "fasting_glucose",
        display: "Fasting glucose",
        value: 120,
        unit: "mg/dL",
        effectiveAt: now - 86_400_000,
        source: "manual",
        createdAt: 2,
        updatedAt: 2,
      },
    );

    const user = userEvent.setup();
    renderWithActor(<RecordPage />, emptyActor);

    await screen.findByTestId("record.tabs");
    await user.click(screen.getByTestId("record.tab.trends"));

    expect(await screen.findByTestId("record.trend.item.1")).toHaveTextContent(
      /Fasting glucose/,
    );
    expect(screen.getByTestId("record.trend.chart.1")).toBeInTheDocument();
    expect(screen.getByTestId("record.trend.direction.1")).toHaveTextContent(
      /rising/i,
    );
  });
});

describe("Predict page: vitals panels", () => {
  it("shows cited range indicators for entered vitals and saves them to the record", async () => {
    const user = userEvent.setup();
    renderWithActor(<PredictPage />, emptyActor);

    await screen.findByTestId("predict.vitals_card");
    await user.type(screen.getByTestId("predict.vitals.systolic_input"), "150");
    await user.type(screen.getByTestId("predict.vitals.spo2_input"), "98");

    expect(
      await screen.findByTestId("predict.vitals.systolic_indicator"),
    ).toHaveTextContent(/out of range/i);
    expect(
      screen.getByTestId("predict.vitals.spo2_indicator"),
    ).toHaveTextContent(/in range/i);

    await user.click(screen.getByTestId("predict.vitals.analyze_button"));

    await waitFor(() => expect(store.data.Observation).toHaveLength(2));
    expect(store.data.Observation.map((o) => o.code)).toEqual(
      expect.arrayContaining(["systolic_bp", "spo2"]),
    );
  });

  it("stops with the emergency banner for a critical vital", async () => {
    const user = userEvent.setup();
    renderWithActor(<PredictPage />, emptyActor);

    await screen.findByTestId("predict.vitals_card");
    await user.type(screen.getByTestId("predict.vitals.systolic_input"), "185");
    await user.click(screen.getByTestId("predict.vitals.analyze_button"));

    const emergency = await screen.findByTestId("predict.emergency_state");
    expect(emergency).toHaveTextContent(/Get emergency help now/i);
    expect(
      within(emergency).getByTestId("predict.emergency_call_button"),
    ).toHaveAttribute("href", `tel:${EMERGENCY_NUMBER}`);
  });
});

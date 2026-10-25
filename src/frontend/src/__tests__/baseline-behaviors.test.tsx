import { renderWithActor } from "@/__tests__/test-utils";
import type { EntityName } from "@/lib/db";
import { EMERGENCY_NUMBER } from "@/lib/emergency";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for behavior the Analyze Labs / vitals / trend work
 * must not disturb: the existing Predict flow (including its Bluetooth autofill
 * and not-a-diagnosis note), the Record dashboard summary and empty states, and
 * the existing navigation entries with the persistent disclaimer banner.
 *
 * The in-memory store mirrors the real `@/lib/db` public contract and returns
 * fresh snapshots so the UI never aliases state.
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

const downloadPdf = vi.hoisted(() => vi.fn());
vi.mock("@/lib/pdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pdf")>();
  return { ...actual, downloadPdf };
});

import App from "@/App";
import PredictPage from "@/pages/PredictPage";
import RecordPage from "@/pages/RecordPage";

const emptyActor = {} as never;

beforeEach(() => {
  store.reset();
  downloadPdf.mockReset();
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Predict page: Bluetooth autofill alongside the model inputs", () => {
  it("offers the latest Bluetooth systolic reading and fills it into the form", async () => {
    store.data.Observation.push({
      id: "obs-1",
      code: "blood-pressure-systolic",
      display: "Blood pressure systolic",
      value: 138,
      unit: "mmHg",
      effectiveAt: Date.now(),
      source: "bluetooth",
      createdAt: 1,
      updatedAt: 1,
    });

    const user = userEvent.setup();
    renderWithActor(<PredictPage />, emptyActor);

    const autofill = await screen.findByTestId("predict.autofill_button");
    await user.click(autofill);

    expect(screen.getByTestId("predict.autofill_success")).toHaveTextContent(
      /filled from your latest reading/i,
    );
    expect(screen.getByTestId("predict.systolic_input")).toHaveValue(138);
  });

  it("shows the not-a-diagnosis note on the input form", async () => {
    renderWithActor(<PredictPage />, emptyActor);

    await screen.findByTestId("predict.form");
    expect(screen.getByTestId("predict.form")).toHaveTextContent(
      /not a diagnosis/i,
    );
  });
});

describe("My Record dashboard: summary and empty states", () => {
  it("counts stored entries and shows an empty timeline when nothing is recorded", async () => {
    store.data.Patient.push({
      id: "p1",
      name: "Ada",
      createdAt: 1,
      updatedAt: 1,
    });
    store.data.Observation.push({
      id: "o1",
      code: "hr",
      display: "Heart rate",
      value: 72,
      unit: "bpm",
      effectiveAt: 1,
      source: "manual",
      createdAt: 1,
      updatedAt: 1,
    });

    renderWithActor(<RecordPage />, emptyActor);

    await screen.findByTestId("record.tabs");
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/entries stored/i)).toBeInTheDocument();
  });

  it("shows the empty state for an entity with no records", async () => {
    const user = userEvent.setup();
    renderWithActor(<RecordPage />, emptyActor);

    await screen.findByTestId("record.tabs");
    await user.click(screen.getByTestId("record.tab.condition"));

    expect(
      await screen.findByTestId("record.condition.empty_state"),
    ).toBeInTheDocument();
  });
});

describe("App shell: existing navigation entries and persistent banner", () => {
  it("keeps every existing nav entry reachable with the disclaimer banner visible", async () => {
    const user = userEvent.setup();
    renderWithActor(<App />, emptyActor);

    await screen.findByTestId("home.page");

    const routes: [string, string][] = [
      ["nav.link.connect", "connect.page"],
      ["nav.link.predict", "predict.page"],
      ["nav.link.my_record", "record.page"],
      ["nav.link.symptoms", "symptoms.page"],
      ["nav.link.how_it_works", "how_it_works.page"],
      ["nav.link.privacy", "privacy.page"],
    ];

    for (const [linkOcid, pageOcid] of routes) {
      await user.click(screen.getByTestId(linkOcid));
      expect(await screen.findByTestId(pageOcid)).toBeInTheDocument();
      const banner = screen.getByTestId("disclaimer.banner");
      expect(banner).toBeInTheDocument();
      expect(
        within(banner).getByTestId("disclaimer.emergency_link"),
      ).toHaveAttribute("href", `tel:${EMERGENCY_NUMBER}`);
    }
  });

  it("keeps the Predict entry between Connect and My Record in the nav order", async () => {
    renderWithActor(<App />, emptyActor);

    await screen.findByTestId("nav.menu");
    const nav = screen.getByTestId("nav.menu");
    const labels = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent?.trim());

    const connectIndex = labels.indexOf("Connect");
    const predictIndex = labels.indexOf("Predict");
    const recordIndex = labels.indexOf("My Record");

    expect(connectIndex).toBeGreaterThanOrEqual(0);
    expect(predictIndex).toBeGreaterThan(connectIndex);
    expect(recordIndex).toBeGreaterThan(predictIndex);
  });
});

import { renderWithActor } from "@/__tests__/test-utils";
import type { EntityName } from "@/lib/db";
import { EMERGENCY_NUMBER } from "@/lib/emergency";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory stand-in for the IndexedDB-backed record store. jsdom has no
 * IndexedDB, and the app's own `@/lib/db` module is the seam the pages read.
 * The fake mirrors the real module's public contract (create/list/update/
 * remove/clearAll) and returns fresh snapshots so the UI never aliases state.
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
import SymptomsPage from "@/pages/SymptomsPage";

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

describe("app shell: disclaimer and navigation", () => {
  it("loads the default route without a blank screen and shows the disclaimer banner", async () => {
    renderWithActor(<App />, emptyActor);

    expect(await screen.findByTestId("home.page")).toBeInTheDocument();
    const banner = screen.getByTestId("disclaimer.banner");
    expect(banner).toHaveTextContent(/not medical advice/i);
    const call = within(banner).getByTestId("disclaimer.emergency_link");
    expect(call).toHaveTextContent(EMERGENCY_NUMBER);
    expect(call).toHaveAttribute("href", `tel:${EMERGENCY_NUMBER}`);
  });

  it("navigates to every primary route without sign-in, keeping the banner visible", async () => {
    const user = userEvent.setup();
    renderWithActor(<App />, emptyActor);

    await screen.findByTestId("home.page");
    expect(screen.queryByTestId("auth.button")).not.toBeInTheDocument();

    const routes: [string, string][] = [
      ["nav.link.connect", "connect.page"],
      ["nav.link.predict", "predict.page"],
      ["nav.link.my_record", "record.page"],
      ["nav.link.symptoms", "symptoms.page"],
      ["nav.link.how_it_works", "how_it_works.page"],
      ["nav.link.privacy", "privacy.page"],
      ["nav.link.home", "home.page"],
    ];

    for (const [linkOcid, pageOcid] of routes) {
      await user.click(screen.getByTestId(linkOcid));
      expect(await screen.findByTestId(pageOcid)).toBeInTheDocument();
      expect(screen.getByTestId("disclaimer.banner")).toBeInTheDocument();
    }
  });
});

/** Render the app shell and navigate to the Connect route (needs a real router). */
async function renderConnectPage() {
  const user = userEvent.setup();
  renderWithActor(<App />, emptyActor);
  // The router is a module singleton, so its location may persist between
  // tests; wait for the shell, then navigate explicitly to Connect.
  await screen.findByTestId("nav.menu");
  await user.click(screen.getByTestId("nav.link.connect"));
  await screen.findByTestId("connect.page");
  return user;
}

describe("Connect page", () => {
  it("shows the unsupported-browser banner when Web Bluetooth is unavailable", async () => {
    await renderConnectPage();

    const banner = screen.getByTestId("connect.unsupported_banner");
    expect(banner).toHaveTextContent(/Web Bluetooth is not available/i);
    expect(banner).toHaveTextContent(/Chrome/i);
    expect(banner).toHaveTextContent(/HTTPS/i);
    expect(screen.getByTestId("connect.connect_button")).toBeDisabled();
  });

  it("never auto-connects on load and only requests a device on click", async () => {
    const requestDevice = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("cancelled"), { name: "NotFoundError" }),
      );
    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: { requestDevice },
    });

    const user = await renderConnectPage();

    expect(requestDevice).not.toHaveBeenCalled();
    expect(screen.getByTestId("connect.status_badge")).toHaveTextContent(
      /Not connected/i,
    );

    await user.click(screen.getByTestId("connect.connect_button"));
    expect(requestDevice).toHaveBeenCalledTimes(1);
    expect(requestDevice).toHaveBeenCalledWith(
      expect.objectContaining({ filters: [{ services: ["heart_rate"] }] }),
    );
  });

  it("charts a received reading, saves it as an Observation, and offers Reconnect after disconnect", async () => {
    const characteristic = new EventTarget() as EventTarget & {
      value: DataView | null;
      startNotifications: () => Promise<unknown>;
    };
    characteristic.value = null;
    characteristic.startNotifications = vi
      .fn()
      .mockResolvedValue(characteristic);

    const device = new EventTarget() as EventTarget & {
      name: string;
      gatt: {
        connect: () => Promise<unknown>;
        disconnect: () => void;
      };
    };
    device.name = "Test Monitor";
    device.gatt = {
      connect: vi.fn().mockResolvedValue({
        getPrimaryService: vi.fn().mockResolvedValue({
          getCharacteristic: vi.fn().mockResolvedValue(characteristic),
        }),
      }),
      disconnect: vi.fn(),
    };

    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: { requestDevice: vi.fn().mockResolvedValue(device) },
    });

    const user = await renderConnectPage();

    await user.click(screen.getByTestId("connect.connect_button"));

    await waitFor(() =>
      expect(screen.getByTestId("connect.status_badge")).toHaveTextContent(
        /Connected/i,
      ),
    );

    // Emit a heart-rate notification: flags byte 0x00, value 72 bpm.
    const payload = new DataView(new Uint8Array([0x00, 72]).buffer);
    characteristic.value = payload;
    characteristic.dispatchEvent(new Event("characteristicvaluechanged"));

    await waitFor(() =>
      expect(screen.getByTestId("connect.latest_value")).toHaveTextContent(
        "72",
      ),
    );
    expect(screen.getByTestId("connect.chart")).toBeInTheDocument();

    await waitFor(() => expect(store.data.Observation).toHaveLength(1));
    expect(store.data.Observation[0]).toMatchObject({
      value: 72,
      unit: "bpm",
      source: "bluetooth",
    });

    // Simulate a device-side disconnect.
    device.dispatchEvent(new Event("gattserverdisconnected"));

    await waitFor(() =>
      expect(
        screen.getByTestId("connect.disconnected_state"),
      ).toBeInTheDocument(),
    );
    const reconnect = screen.getByTestId("connect.reconnect_button");
    expect(reconnect).toBeInTheDocument();

    await user.click(reconnect);
    await waitFor(() =>
      expect(screen.getByTestId("connect.status_badge")).toHaveTextContent(
        /Connected/i,
      ),
    );
  });
});

describe("Predict page", () => {
  it("produces a numeric score, band, summary, and top 3 factors from valid inputs", async () => {
    const user = userEvent.setup();
    renderWithActor(<PredictPage />, emptyActor);

    await user.type(screen.getByTestId("predict.age_input"), "55");
    await user.type(
      screen.getByTestId("predict.total_cholesterol_input"),
      "220",
    );
    await user.type(screen.getByTestId("predict.hdl_input"), "45");
    await user.type(screen.getByTestId("predict.systolic_input"), "140");
    await user.click(screen.getByTestId("predict.submit_button"));

    const score = await screen.findByTestId("predict.score_value");
    expect(Number(score.textContent)).toBeGreaterThan(0);
    expect(screen.getByTestId("predict.band_badge")).toHaveTextContent(
      /Low|Moderate|High/,
    );
    expect(screen.getByTestId("predict.gauge")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Risk gauge: .* percent, (Low|Moderate|High) band/),
    );
    expect(screen.getByTestId("predict.summary")).toHaveTextContent(
      /10-year risk/i,
    );
    expect(screen.getByTestId("predict.factor.1")).toBeInTheDocument();
    expect(screen.getByTestId("predict.factor.2")).toBeInTheDocument();
    expect(screen.getByTestId("predict.factor.3")).toBeInTheDocument();
    expect(screen.queryByTestId("predict.factor.4")).not.toBeInTheDocument();
  });

  it("blocks submission and shows validation errors for out-of-range inputs", async () => {
    const user = userEvent.setup();
    renderWithActor(<PredictPage />, emptyActor);

    await user.type(screen.getByTestId("predict.age_input"), "20");
    await user.click(screen.getByTestId("predict.submit_button"));

    expect(await screen.findByTestId("predict.age_error")).toHaveTextContent(
      /30 to 74/,
    );
    expect(screen.queryByTestId("predict.score_value")).not.toBeInTheDocument();
  });

  it("recalculates after inputs change and downloads a PDF with score, band, factors, next steps, and model version", async () => {
    const user = userEvent.setup();
    renderWithActor(<PredictPage />, emptyActor);

    await user.type(screen.getByTestId("predict.age_input"), "55");
    await user.type(
      screen.getByTestId("predict.total_cholesterol_input"),
      "220",
    );
    await user.type(screen.getByTestId("predict.hdl_input"), "45");
    await user.type(screen.getByTestId("predict.systolic_input"), "140");
    await user.click(screen.getByTestId("predict.submit_button"));

    const firstScore = (await screen.findByTestId("predict.score_value"))
      .textContent;

    await user.click(screen.getByTestId("predict.recalculate_button"));
    expect(screen.getByTestId("predict.form")).toBeInTheDocument();

    await user.clear(screen.getByTestId("predict.systolic_input"));
    await user.type(screen.getByTestId("predict.systolic_input"), "180");
    await user.click(screen.getByTestId("predict.submit_button"));

    const secondScore = (await screen.findByTestId("predict.score_value"))
      .textContent;
    expect(secondScore).not.toBe(firstScore);

    await user.click(screen.getByTestId("predict.download_button"));
    expect(downloadPdf).toHaveBeenCalledTimes(1);
    const [doc] = downloadPdf.mock.calls[0];
    expect(doc.title).toMatch(/Cardiovascular Risk Estimate/i);
    expect(doc.subtitle).toMatch(/Framingham/);
    const headings = doc.sections.map((s: { heading?: string }) => s.heading);
    expect(headings).toEqual(
      expect.arrayContaining([
        "Result",
        "Top contributing factors",
        "Next steps",
      ]),
    );
    const resultLines = doc.sections
      .find((s: { heading?: string }) => s.heading === "Result")
      .lines.join(" ");
    expect(resultLines).toMatch(/10-year risk: \d/);
    expect(resultLines).toMatch(/Risk band: (Low|Moderate|High)/);
  });
});

describe("Symptoms page", () => {
  it("ranks possible conditions for a non-red-flag selection", async () => {
    const user = userEvent.setup();
    renderWithActor(<SymptomsPage />, emptyActor);

    await user.click(screen.getByTestId("symptoms.option.cough"));
    await user.click(screen.getByTestId("symptoms.option.runny_nose"));

    const results = await screen.findByTestId("symptoms.results_section");
    expect(
      within(results).getByTestId("symptoms.result.1"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("symptoms.emergency_state"),
    ).not.toBeInTheDocument();
  });

  it("stops prediction and shows the emergency banner for a red-flag symptom", async () => {
    const user = userEvent.setup();
    renderWithActor(<SymptomsPage />, emptyActor);

    await user.click(screen.getByTestId("symptoms.option.chest_pain"));

    const emergency = await screen.findByTestId("symptoms.emergency_state");
    expect(emergency).toHaveTextContent(/Get emergency help now/i);
    expect(
      within(emergency).getByTestId("symptoms.emergency_call_button"),
    ).toHaveAttribute("href", `tel:${EMERGENCY_NUMBER}`);
    expect(
      screen.queryByTestId("symptoms.results_section"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("symptoms.result.1")).not.toBeInTheDocument();
  });

  it("saves the symptom selection to the record", async () => {
    const user = userEvent.setup();
    renderWithActor(<SymptomsPage />, emptyActor);

    await user.click(screen.getByTestId("symptoms.option.cough"));
    await user.click(screen.getByTestId("symptoms.save_button"));

    expect(
      await screen.findByTestId("symptoms.save_success_state"),
    ).toHaveTextContent(/Saved to your record/i);
    expect(store.data.QuestionnaireResponse).toHaveLength(1);
    expect(store.data.QuestionnaireResponse[0]).toMatchObject({
      questionnaire: "Symptom checker",
    });
  });
});

describe("My Record page", () => {
  it("adds an observation, shows it in its tab and the timeline, then edits it", async () => {
    const user = userEvent.setup();
    renderWithActor(<RecordPage />, emptyActor);

    await screen.findByTestId("record.tabs");
    await user.click(screen.getByTestId("record.tab.observation"));
    await user.click(screen.getByTestId("record.add_button.observation"));

    await user.type(
      screen.getByTestId("record.form.display_input"),
      "Blood pressure systolic",
    );
    await user.type(screen.getByTestId("record.form.value_input"), "128");
    await user.type(screen.getByTestId("record.form.unit_input"), "mmHg");
    await user.click(screen.getByTestId("record.form.submit_button"));

    await waitFor(() =>
      expect(screen.getByTestId("record.item.1")).toHaveTextContent(
        "Blood pressure systolic",
      ),
    );

    // Timeline shows the same entry.
    await user.click(screen.getByTestId("record.tab.timeline"));
    expect(screen.getByTestId("record.timeline.item.1")).toHaveTextContent(
      "Blood pressure systolic",
    );

    // Edit the entry.
    await user.click(screen.getByTestId("record.tab.observation"));
    await user.click(screen.getByTestId("record.edit_button.1"));
    const valueInput = screen.getByTestId("record.form.value_input");
    await user.clear(valueInput);
    await user.type(valueInput, "132");
    await user.click(screen.getByTestId("record.form.submit_button"));

    await waitFor(() =>
      expect(screen.getByTestId("record.item.1")).toHaveTextContent("132 mmHg"),
    );
  });

  it("requires confirmation before clearing all local data", async () => {
    store.data.Patient.push({
      id: "p1",
      name: "Ada",
      createdAt: 1,
      updatedAt: 1,
    });

    const user = userEvent.setup();
    renderWithActor(<RecordPage />, emptyActor);

    await screen.findByTestId("record.tabs");
    await user.click(screen.getByTestId("record.delete_all_button"));

    const modal = await screen.findByTestId("record.delete_all.modal");
    expect(modal).toHaveTextContent(/cannot be undone/i);

    // Cancel keeps the data.
    await user.click(screen.getByTestId("record.delete_all.cancel_button"));
    expect(store.data.Patient).toHaveLength(1);

    // Confirm clears it.
    await user.click(screen.getByTestId("record.delete_all_button"));
    await user.click(
      await screen.findByTestId("record.delete_all.confirm_button"),
    );
    await waitFor(() => expect(store.data.Patient).toHaveLength(0));
  });

  it("exports the record as JSON and PDF", async () => {
    store.data.Condition.push({
      id: "c1",
      code: "hypertension",
      display: "Hypertension",
      clinicalStatus: "active",
      createdAt: 1,
      updatedAt: 1,
    });

    const createObjectURL = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });

    const user = userEvent.setup();
    renderWithActor(<RecordPage />, emptyActor);

    await screen.findByTestId("record.tabs");
    await user.click(screen.getByTestId("record.export_json_button"));
    expect(createObjectURL).toHaveBeenCalled();
    expect(screen.getByTestId("record.success_state")).toHaveTextContent(
      /JSON export downloaded/i,
    );

    await user.click(screen.getByTestId("record.export_pdf_button"));
    expect(downloadPdf).toHaveBeenCalledTimes(1);
    const [doc] = downloadPdf.mock.calls[0];
    expect(doc.title).toMatch(/My Record/i);
  });
});

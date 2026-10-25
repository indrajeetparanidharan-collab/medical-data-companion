import { renderWithActor } from "@/__tests__/test-utils";
import { applyTheme, getStoredTheme, initTheme } from "@/lib/theme";
import HowItWorksPage from "@/pages/HowItWorksPage";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

const emptyActor = {} as never;

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("dark mode persistence", () => {
  it("persists the chosen theme across a reload", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(getStoredTheme()).toBe("dark");

    // Simulate a reload: the class is gone, but the stored preference remains.
    document.documentElement.classList.remove("dark");
    expect(initTheme()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("falls back to light when nothing is stored and the OS prefers light", () => {
    expect(getStoredTheme()).toBe("light");
  });
});

describe("How It Works page", () => {
  it("documents the Framingham General CVD model that the prediction screen runs", () => {
    renderWithActor(<HowItWorksPage />, emptyActor);

    // The page names the same model the Predict screen applies.
    expect(screen.getByTestId("how_it_works.version_badge")).toHaveTextContent(
      /Framingham General CVD Risk Profile/i,
    );

    const modelCard = screen.getByTestId("how_it_works.model_card");
    expect(modelCard).toHaveTextContent(/Framingham General CVD Risk Profile/i);
    expect(modelCard).toHaveTextContent(/Cox/i);
    expect(modelCard).toHaveTextContent(/10-year/i);
    // The published model version is stated on the page.
    expect(modelCard).toHaveTextContent(/D'Agostino/i);
    expect(modelCard).toHaveTextContent(/Circulation 2008/i);
  });

  it("lists the model inputs, the three risk bands, and the published citations", () => {
    renderWithActor(<HowItWorksPage />, emptyActor);

    const inputs = screen.getByTestId("how_it_works.inputs_list");
    for (const label of [
      "Age",
      "Sex",
      "Total cholesterol",
      "HDL cholesterol",
      "Systolic blood pressure",
      "Blood-pressure treatment",
      "Current smoker",
      "Diabetes",
    ]) {
      expect(inputs).toHaveTextContent(label);
    }

    expect(screen.getByTestId("how_it_works.band.low")).toHaveTextContent(
      /under 10%/i,
    );
    expect(screen.getByTestId("how_it_works.band.moderate")).toHaveTextContent(
      /10% to under 20%/i,
    );
    expect(screen.getByTestId("how_it_works.band.high")).toHaveTextContent(
      /20% or more/i,
    );

    const sources = screen.getByTestId("how_it_works.sources_list");
    expect(sources).toHaveTextContent(/D'Agostino/i);
    expect(sources).toHaveTextContent(/Framingham Heart Study/i);
    const links = screen.getAllByTestId("how_it_works.source_link");
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) {
      expect(link).toHaveAttribute(
        "href",
        expect.stringMatching(/^https:\/\//),
      );
    }
  });
});

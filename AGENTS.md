# Project Guidance

## User Preferences

- Mobile-first layout for Chrome
- All data stays client-side in the browser; no server and no trackers
- Clean clinical-friendly palette of soft blues and greens
- WCAG 2.1 AA accessibility, dark mode, big tap targets, plain language
- No signup required to view results
- Never auto-connect Bluetooth
- Never social-share results

## Accepted Requirements

- Persistent educational disclaimer banner with emergency number
- Web Bluetooth connect, GATT characteristic notifications, live chart, disconnect/reconnect handling, unsupported-browser banner
- Client-side prediction with numeric score, color-coded Low/Moderate/High gauge, plain-language result, top 3 factors, next steps, PDF download, recalculate, and cited How It Works
- Local FHIR-inspired record with Patient, Observation, Condition, MedicationStatement, AllergyIntolerance, QuestionnaireResponse; dashboard tabs, timeline, add/edit forms, JSON/PDF export, delete-all with confirmation
- Educational symptom checker with searchable multi-select, ranked top 3–5 conditions, red-flag emergency stop, and save to record
- Navigation across Home, Connect, Predict, My Record, Symptoms, How It Works, Privacy
- Client-side-only storage with no server transmission, no trackers, and no signup
- New Analyze Labs page and nav entry for blood-marker input panels with unit toggles and green/amber/red normal-range indicators
- Client-side rule engine flagging out-of-range values as mild/moderate/critical and ranking top 3–5 possible conditions with plain-language explainability
- Auto-save of analysis results to the Patient Record
- Trend analysis versus previous readings with sparklines and direction arrows
- Red-flag rule for critical vitals (BP >180/120, glucose >300, SpO2 <90%) that stops and shows an emergency banner, plus a persistent 'not a diagnosis' note
- Vitals input panels (BP, HR, temp, SpO2, BMI) alongside the existing prediction flow
- Trend charts on the Patient Record dashboard

## Verified Commands

- **typecheck**: `pnpm typecheck`
- **fix**: `pnpm fix`
- **build**: `pnpm build`

## Learnings

- Frontend commands from src/frontend/: typecheck pnpm typecheck, lint fix pnpm fix, build pnpm build. Backend commands from src/backend/: typecheck mops check --fix, build mops build. Root bindgen command is pnpm bindgen.
- The app stores all health data client-side in IndexedDB via src/frontend/src/lib/db.ts; the backend is a thin composition root with authorization helpers, an empty OQL Expose, and getApiDoc in src/backend/mixins/api-doc.mo.
- PredictPage.tsx implements the Framingham General CVD Cox model (D'Agostino 2008) with inputs age, sex, total cholesterol, HDL, systolic, treated, smoker, diabetic and bands under 10 / 10-20 / 20+ percent; HowItWorksPage.tsx must document that same model, version, and citations.
- Biome lint/a11y/useSemanticElements rejects role="status" on <p>; use <output> for live status regions to pass pnpm fix.
- Tailwind animate-* utilities need a motion-safe: prefix or a prefers-reduced-motion CSS rule in index.css; the app uses both.
- Web Bluetooth types are absent from the TS DOM lib; src/frontend/src/types/web-bluetooth.d.ts declares ambient types without adding @types/web-bluetooth.
- jsPDF is not preinstalled; src/frontend/src/lib/pdf.ts writes a valid PDF 1.4 by hand with Helvetica text and a Blob download, no dependency added.
- tailwind.config.js needs explicit warning/success color mappings or bg-warning/text-success classes are silently dropped.
- The Connect page publishes the latest reading to window.sessionStorage under LATEST_READING_KEY ("vitals-ledger-latest-reading") as JSON {bpm, at, device} for the Predict page to auto-fill.
- Analyze Labs lives at src/frontend/src/pages/AnalyzeLabsPage.tsx with route /analyze-labs; its nav entry sits between Predict and My Record in NAV_ITEMS.
- src/frontend/src/lib/clinical.ts holds cited marker definitions (MARKERS) with normal/mild/moderate/critical bands and WHO/NICE/AHA sources; src/frontend/src/lib/analysis.ts exports flagValue, analyze, SUPPORTED_MARKERS and the redFlag result; src/frontend/src/lib/trends.ts exports compareTrend, trendLabel and sparklinePoints.
- AnalyzeLabsPage renders one panel per SUPPORTED_MARKERS entry, so a required marker with no MARKERS definition silently loses its input panel.
- Unit toggles must convert the stored value to canonical then into the target unit, not just swap the unit label.
- PredictPage.tsx now carries vitals panels (BP, HR, temperature, SpO2, BMI) that reuse clinical.ts ranges and save Observations; RecordPage.tsx has a Trends tab with Recharts line charts and per-marker sparklines.

/**
 * Local-only health record storage backed by IndexedDB.
 *
 * All health data stays in the browser. Nothing is sent to a server and no
 * trackers are used. The entities follow a FHIR-inspired shape so records read
 * like a lab sheet the patient owns.
 */

export type EntityName =
  | "Patient"
  | "Observation"
  | "Condition"
  | "MedicationStatement"
  | "AllergyIntolerance"
  | "QuestionnaireResponse";

export interface Patient {
  id: string;
  name: string;
  birthDate?: string;
  sex?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Observation {
  id: string;
  code: string;
  display: string;
  value: number;
  unit: string;
  effectiveAt: number;
  source: "manual" | "bluetooth";
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Condition {
  id: string;
  code: string;
  display: string;
  clinicalStatus: "active" | "resolved" | "inactive";
  onsetDate?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MedicationStatement {
  id: string;
  medication: string;
  dose?: string;
  frequency?: string;
  status: "active" | "stopped" | "completed";
  startedAt?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AllergyIntolerance {
  id: string;
  substance: string;
  reaction?: string;
  severity: "mild" | "moderate" | "severe";
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface QuestionnaireResponse {
  id: string;
  questionnaire: string;
  answers: Record<string, string>;
  completedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface EntityMap {
  Patient: Patient;
  Observation: Observation;
  Condition: Condition;
  MedicationStatement: MedicationStatement;
  AllergyIntolerance: AllergyIntolerance;
  QuestionnaireResponse: QuestionnaireResponse;
}

export const ENTITY_NAMES: EntityName[] = [
  "Patient",
  "Observation",
  "Condition",
  "MedicationStatement",
  "AllergyIntolerance",
  "QuestionnaireResponse",
];

const DB_NAME = "vitals-ledger";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ENTITY_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx<T>(
  entity: EntityName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(entity, mode);
        const request = run(transaction.objectStore(entity));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/** Generate a stable, collision-resistant record id. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Create a record, stamping ids and timestamps. */
export async function create<K extends EntityName>(
  entity: K,
  record: Omit<EntityMap[K], "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  },
): Promise<EntityMap[K]> {
  const now = Date.now();
  const full = {
    ...record,
    id: record.id ?? newId(),
    createdAt: now,
    updatedAt: now,
  } as EntityMap[K];
  await tx(entity, "readwrite", (store) => store.put(full));
  return full;
}

/** Update an existing record, refreshing `updatedAt`. */
export async function update<K extends EntityName>(
  entity: K,
  id: string,
  changes: Partial<EntityMap[K]>,
): Promise<EntityMap[K]> {
  const existing = await get<K>(entity, id);
  if (!existing) throw new Error(`${entity} ${id} not found`);
  const next = {
    ...existing,
    ...changes,
    id,
    updatedAt: Date.now(),
  } as EntityMap[K];
  await tx(entity, "readwrite", (store) => store.put(next));
  return next;
}

/** Read a single record by id. */
export function get<K extends EntityName>(
  entity: K,
  id: string,
): Promise<EntityMap[K] | undefined> {
  return tx<EntityMap[K] | undefined>(entity, "readonly", (store) =>
    store.get(id),
  );
}

/** List every record in an entity store. */
export function list<K extends EntityName>(entity: K): Promise<EntityMap[K][]> {
  return tx<EntityMap[K][]>(entity, "readonly", (store) => store.getAll());
}

/** Delete a single record. */
export async function remove(entity: EntityName, id: string): Promise<void> {
  await tx(entity, "readwrite", (store) => store.delete(id));
}

/** Delete every record in every entity store. */
export async function clearAll(): Promise<void> {
  const db = await openDb();
  await Promise.all(
    ENTITY_NAMES.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(name, "readwrite");
          const request = transaction.objectStore(name).clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
    ),
  );
}

/** Count records per entity, used by the record dashboard. */
export async function counts(): Promise<Record<EntityName, number>> {
  const entries = await Promise.all(
    ENTITY_NAMES.map(
      async (name) => [name, (await list(name)).length] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<EntityName, number>;
}

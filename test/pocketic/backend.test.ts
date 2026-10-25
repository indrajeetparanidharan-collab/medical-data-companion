import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";

let pic: PocketIc | undefined;
let actor: Actor<_SERVICE>;
let canisterId: CanisterFixture<_SERVICE>["canisterId"];

beforeAll(async () => {
  pic = await PocketIc.create(PIC_URL);
  ({ actor, canisterId } = await pic.setupCanister<_SERVICE>({
    idlFactory,
    wasm: BACKEND_WASM,
  }));
});

afterAll(async () => {
  await pic?.tearDown();
});

it("answers the schema and API-doc reads instead of trapping", async () => {
  await expect(actor.schema()).resolves.toEqual(expect.any(String));
  await expect(actor.getApiDoc()).resolves.toEqual(expect.any(String));
});

it("reports the caller's role and admin status without trapping", async () => {
  await expect(actor.getCallerUserRole()).resolves.toBeDefined();
  await expect(actor.isCallerAdmin()).resolves.toEqual(expect.any(Boolean));
});

it("registers the first caller as admin and later callers as users", async () => {
  const alice = createIdentity("alice");
  const bob = createIdentity("bob");

  const aliceActor = pic!.createActor<_SERVICE>(idlFactory, canisterId);
  aliceActor.setIdentity(alice);
  await aliceActor._initialize_access_control();
  await expect(aliceActor.isCallerAdmin()).resolves.toBe(true);

  const bobActor = pic!.createActor<_SERVICE>(idlFactory, canisterId);
  bobActor.setIdentity(bob);
  await bobActor._initialize_access_control();
  await expect(bobActor.isCallerAdmin()).resolves.toBe(false);
  await expect(bobActor.getCallerUserRole()).resolves.toEqual({ user: null });
});

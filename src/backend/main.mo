import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import Expose "mo:caffeineai-oql/Expose";
import ApiDocMixin "mixins/api-doc";

/// Composition root for the backend.
///
/// All health data (patient records, observations, conditions, medications,
/// allergies, questionnaire responses, Bluetooth readings, and prediction
/// results) lives client-side in the browser. This canister intentionally
/// accepts, stores, and transmits no health data.
///
/// The only backend responsibilities are:
///   - the shared authorization helpers (assignCallerUserRole,
///     getCallerUserRole, isCallerAdmin) provided by MixinAuthorization, and
///   - the OQL Expose mixin, which currently exposes no entities because the
///     canister persists no queryable data.
actor {
  let accessControlState : AccessControl.AccessControlState;
  include MixinAuthorization(accessControlState, null);
  include Expose({ entities = [] });
  include ApiDocMixin();
};

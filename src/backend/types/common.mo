/// Shared cross-cutting types for the backend.
///
/// This app keeps all health data client-side in the browser (IndexedDB).
/// The backend deliberately stores no health data, so these types describe
/// only the minimal, non-sensitive surface the canister exposes.
module {
  /// A UTC timestamp in nanoseconds since the Unix epoch.
  /// Signed so it can represent pre-epoch values without trapping.
  public type Timestamp = Int;

  /// A stable, client-generated identifier for a locally stored record.
  /// The backend never persists these; they exist only for API shape parity.
  public type RecordId = Text;
};

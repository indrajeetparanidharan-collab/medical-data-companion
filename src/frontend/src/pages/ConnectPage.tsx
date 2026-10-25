import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { create } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Bluetooth,
  BluetoothConnected,
  BluetoothSearching,
  CheckCircle2,
  Gauge,
  Info,
  Link2Off,
  RefreshCw,
  ShieldAlert,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Web Bluetooth configuration for the paired health device.
 *
 * The service and characteristic UUIDs identify a standard heart-rate
 * measurement service. They are the only filter applied to
 * `navigator.bluetooth.requestDevice`, so the browser picker shows just the
 * compatible devices the user owns.
 */
const SERVICE_UUID = "heart_rate";
const CHARACTERISTIC_UUID = "heart_rate_measurement";

/** Session key the Predict screen reads to auto-fill its fields. */
export const LATEST_READING_KEY = "vitals-ledger-latest-reading";

/** A single decoded reading streamed from the device. */
interface Reading {
  id: string;
  bpm: number;
  at: number;
}

type ConnectionState =
  | "idle"
  | "requesting"
  | "connecting"
  | "connected"
  | "disconnected";

type ErrorKind =
  | "unsupported"
  | "permission"
  | "not_found"
  | "connection"
  | "gatt";

interface ConnectError {
  kind: ErrorKind;
  title: string;
  message: string;
}

const MAX_POINTS = 40;

/** True when the current browser exposes the Web Bluetooth API. */
function hasWebBluetooth(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "bluetooth" in navigator &&
    typeof (navigator as Navigator & { bluetooth?: unknown }).bluetooth ===
      "object"
  );
}

/**
 * Decode a Bluetooth GATT heart-rate measurement payload.
 *
 * Flags occupy the first byte; bit 0 signals a 16-bit value. The measurement
 * itself follows in little-endian order.
 */
function decodeHeartRate(dataView: DataView): number | null {
  if (dataView.byteLength < 2) return null;
  const flags = dataView.getUint8(0);
  const is16Bit = (flags & 0x01) !== 0;
  if (is16Bit) {
    if (dataView.byteLength < 3) return null;
    return dataView.getUint16(1, true);
  }
  return dataView.getUint8(1);
}

function describeError(error: unknown): ConnectError {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";

  switch (name) {
    case "NotFoundError":
      return {
        kind: "not_found",
        title: "No device selected",
        message:
          "No device was chosen. Tap Connect Device and pick your monitor from the list.",
      };
    case "SecurityError":
    case "NotAllowedError":
      return {
        kind: "permission",
        title: "Bluetooth permission denied",
        message:
          "Your browser blocked Bluetooth access. Allow Bluetooth for this site in the address bar, then try again.",
      };
    case "NetworkError":
      return {
        kind: "connection",
        title: "Connection failed",
        message:
          "The device could not be reached. Make sure it is switched on, in range, and not paired to another phone.",
      };
    default:
      return {
        kind: "connection",
        title: "Something went wrong",
        message:
          "The connection dropped unexpectedly. Try reconnecting to your device.",
      };
  }
}

function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function ConnectPage() {
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<ConnectError | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(
    null,
  );
  const handlerRef = useRef<((event: Event) => void) | null>(null);

  useEffect(() => {
    setSupported(hasWebBluetooth());
  }, []);

  const latest = readings.length > 0 ? readings[readings.length - 1] : null;

  const detach = useCallback(() => {
    const characteristic = characteristicRef.current;
    const handler = handlerRef.current;
    if (characteristic && handler) {
      try {
        characteristic.removeEventListener(
          "characteristicvaluechanged",
          handler,
        );
      } catch {
        // The characteristic may already be gone; nothing to clean up.
      }
    }
    characteristicRef.current = null;
    handlerRef.current = null;
  }, []);

  const handleDisconnect = useCallback(() => {
    detach();
    setState("disconnected");
  }, [detach]);

  const handleNotification = useCallback((event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic | null;
    if (!target?.value) return;
    const bpm = decodeHeartRate(target.value);
    if (bpm === null || bpm <= 0) return;

    const at = Date.now();
    setReadings((prev) => {
      const next = [...prev, { id: `${at}-${bpm}`, bpm, at }];
      return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
    });

    void create("Observation", {
      code: "8867-4",
      display: "Heart rate",
      value: bpm,
      unit: "bpm",
      effectiveAt: at,
      source: "bluetooth",
      notes: "Streamed from a connected Bluetooth monitor.",
    })
      .then(() => setSavedCount((count) => count + 1))
      .catch(() => {
        // A storage failure must not interrupt the live stream.
      });
  }, []);

  const connect = useCallback(
    async (device: BluetoothDevice) => {
      setState("connecting");
      setError(null);
      try {
        const server = await device.gatt?.connect();
        if (!server) throw new Error("GATT server unavailable");
        const service = await server.getPrimaryService(SERVICE_UUID);
        const characteristic =
          await service.getCharacteristic(CHARACTERISTIC_UUID);
        await characteristic.startNotifications();

        const handler = (event: Event) => handleNotification(event);
        characteristic.addEventListener("characteristicvaluechanged", handler);

        characteristicRef.current = characteristic;
        handlerRef.current = handler;
        deviceRef.current = device;
        setDeviceName(device.name ?? "Health monitor");
        setState("connected");
      } catch (caught) {
        detach();
        setError(describeError(caught));
        setState("disconnected");
      }
    },
    [detach, handleNotification],
  );

  const requestDevice = useCallback(async () => {
    if (!hasWebBluetooth()) {
      setSupported(false);
      return;
    }
    setState("requesting");
    setError(null);
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID],
      });
      device.removeEventListener("gattserverdisconnected", handleDisconnect);
      device.addEventListener("gattserverdisconnected", handleDisconnect);
      await connect(device);
    } catch (caught) {
      const described = describeError(caught);
      // A cancelled picker is not an error worth alarming the user about.
      if (described.kind === "not_found") {
        setState("idle");
        return;
      }
      setError(described);
      setState("idle");
    }
  }, [connect, handleDisconnect]);

  const reconnect = useCallback(async () => {
    const device = deviceRef.current;
    if (!device) {
      await requestDevice();
      return;
    }
    await connect(device);
  }, [connect, requestDevice]);

  const carryToPredict = useCallback(() => {
    if (!latest) return;
    try {
      window.sessionStorage.setItem(
        LATEST_READING_KEY,
        JSON.stringify({
          bpm: latest.bpm,
          at: latest.at,
          device: deviceName,
        }),
      );
    } catch {
      // Storage can be unavailable; the Predict screen simply starts blank.
    }
  }, [deviceName, latest]);

  const chartData = readings.map((reading) => ({
    time: formatClock(reading.at),
    bpm: reading.bpm,
  }));

  const isConnected = state === "connected";
  const isBusy = state === "requesting" || state === "connecting";

  return (
    <section data-ocid="connect.page" className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Device
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Connect
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Pair a Bluetooth health monitor to stream readings into your record.
          Nothing connects until you tap the button.
        </p>
      </header>

      {!supported && (
        <Alert
          data-ocid="connect.unsupported_banner"
          className="border-warning/40 bg-warning/10"
        >
          <WifiOff aria-hidden="true" className="size-4 text-warning" />
          <AlertTitle>Web Bluetooth is not available here</AlertTitle>
          <AlertDescription>
            Live device streaming needs Google Chrome on a secure HTTPS
            connection. You can still add readings by hand on the My Record
            screen.
          </AlertDescription>
        </Alert>
      )}

      <Card
        data-ocid="connect.status_card"
        className="rounded-lg border-border shadow-subtle"
      >
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="font-display text-lg">
              Device status
            </CardTitle>
            <StatusBadge state={state} />
          </div>
          <CardDescription>
            {isConnected
              ? `Streaming from ${deviceName ?? "your monitor"}.`
              : "No device connected yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            {isConnected ? (
              <Button
                type="button"
                variant="secondary"
                data-ocid="connect.disconnect_button"
                className="tap-target w-full rounded-full sm:w-auto"
                onClick={() => {
                  deviceRef.current?.gatt?.disconnect();
                  handleDisconnect();
                }}
              >
                <Link2Off aria-hidden="true" className="size-4" />
                Disconnect
              </Button>
            ) : (
              <Button
                type="button"
                data-ocid="connect.connect_button"
                className="tap-target w-full rounded-full sm:w-auto"
                disabled={isBusy || !supported}
                onClick={() => void requestDevice()}
              >
                {isBusy ? (
                  <BluetoothSearching
                    aria-hidden="true"
                    className="size-4 motion-safe:animate-pulse"
                  />
                ) : (
                  <Bluetooth aria-hidden="true" className="size-4" />
                )}
                {state === "requesting"
                  ? "Choosing device…"
                  : state === "connecting"
                    ? "Connecting…"
                    : "Connect Device"}
              </Button>
            )}

            {state === "disconnected" && (
              <Button
                type="button"
                variant="secondary"
                data-ocid="connect.reconnect_button"
                className="tap-target w-full rounded-full sm:w-auto"
                onClick={() => void reconnect()}
              >
                <RefreshCw aria-hidden="true" className="size-4" />
                Reconnect
              </Button>
            )}
          </div>

          {error && (
            <Alert
              data-ocid="connect.error_state"
              variant="destructive"
              className="rounded-lg"
            >
              <ShieldAlert aria-hidden="true" className="size-4" />
              <AlertTitle>{error.title}</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {state === "disconnected" && !error && (
            <Alert
              data-ocid="connect.disconnected_state"
              className="rounded-lg border-warning/40 bg-warning/10"
            >
              <AlertTriangle
                aria-hidden="true"
                className="size-4 text-warning"
              />
              <AlertTitle>Device disconnected</AlertTitle>
              <AlertDescription>
                The stream stopped. Tap Reconnect to resume readings from the
                same monitor.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card
        data-ocid="connect.live_card"
        className="rounded-lg border-border shadow-subtle"
      >
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="font-display text-lg">
              Latest reading
            </CardTitle>
            {isConnected && (
              <Badge
                data-ocid="connect.live_badge"
                className="gap-1 rounded-full bg-accent/15 text-accent"
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 motion-safe:animate-pulse rounded-full bg-accent"
                />
                Live
              </Badge>
            )}
          </div>
          <CardDescription>
            {latest
              ? `Updated at ${formatClock(latest.at)}.`
              : "Waiting for the first reading from your device."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <span
              data-ocid="connect.latest_value"
              className="font-mono text-5xl font-bold leading-none tracking-tight text-foreground"
            >
              {latest ? latest.bpm : "--"}
            </span>
            <span className="pb-1 text-sm font-medium text-muted-foreground">
              bpm
            </span>
          </div>

          <div
            data-ocid="connect.chart"
            className="h-48 w-full rounded-lg border border-border bg-muted/30 p-2"
          >
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
                >
                  <defs>
                    <linearGradient id="bpmFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--accent)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--accent)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    domain={["dataMin - 5", "dataMax + 5"]}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "0.75rem",
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      color: "var(--card-foreground)",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                    formatter={(value) => [
                      `${String(value)} bpm`,
                      "Heart rate",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="bpm"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    fill="url(#bpmFill)"
                    isAnimationActive={false}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div
                data-ocid="connect.chart.empty_state"
                className="flex h-full flex-col items-center justify-center gap-2 text-center"
              >
                <Activity
                  aria-hidden="true"
                  className="size-6 text-muted-foreground"
                />
                <p className="text-sm text-muted-foreground">
                  Your live heart rate will appear here once streaming starts.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p
              data-ocid="connect.saved_count"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <CheckCircle2
                aria-hidden="true"
                className="size-4 text-success"
              />
              {savedCount === 0
                ? "Readings are saved to your record as they arrive."
                : `${savedCount} reading${savedCount === 1 ? "" : "s"} saved to your record.`}
            </p>
            <Button
              asChild
              variant="secondary"
              className={cn(
                "tap-target w-full rounded-full sm:w-auto",
                !latest && "pointer-events-none opacity-50",
              )}
            >
              <Link
                to="/predict"
                data-ocid="connect.carry_to_predict_button"
                aria-disabled={!latest}
                onClick={carryToPredict}
              >
                <Gauge aria-hidden="true" className="size-4" />
                Use in prediction
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert
        data-ocid="connect.privacy_note"
        className="rounded-lg border-border bg-muted/40"
      >
        <Info aria-hidden="true" className="size-4 text-primary" />
        <AlertTitle>Your data stays on this device</AlertTitle>
        <AlertDescription>
          Readings are stored only in this browser and are never uploaded.
        </AlertDescription>
      </Alert>
    </section>
  );
}

function StatusBadge({ state }: { state: ConnectionState }) {
  const config: Record<
    ConnectionState,
    { label: string; className: string; icon: typeof Bluetooth }
  > = {
    idle: {
      label: "Not connected",
      className: "bg-muted text-muted-foreground",
      icon: Bluetooth,
    },
    requesting: {
      label: "Choosing device",
      className: "bg-secondary text-secondary-foreground",
      icon: BluetoothSearching,
    },
    connecting: {
      label: "Connecting",
      className: "bg-secondary text-secondary-foreground",
      icon: BluetoothSearching,
    },
    connected: {
      label: "Connected",
      className: "bg-accent/15 text-accent",
      icon: BluetoothConnected,
    },
    disconnected: {
      label: "Disconnected",
      className: "bg-warning/15 text-warning",
      icon: Link2Off,
    },
  };

  const { label, className, icon: Icon } = config[state];

  return (
    <Badge
      data-ocid="connect.status_badge"
      className={cn("gap-1 rounded-full", className)}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </Badge>
  );
}

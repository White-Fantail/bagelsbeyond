"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { BagelTypeWithState } from "@/lib/services/bagel-availability-service";

// ── Web Speech API types (not universally in TypeScript's lib.dom.d.ts) ───────

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type SyncStatus = "idle" | "syncing" | "success" | "failed";

type BagelState = BagelTypeWithState & {
  syncStatus: SyncStatus;
};

interface VoiceState {
  listening: boolean;
  transcript: string;
  preview: string | null;
  pendingCommand: { bagelTypeId: string; bagelCode: string; bagelName: string; isAvailable: boolean; preview: string } | null;
  error: string | null;
}

// ── Channel badge colors ───────────────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  loyverse: "bg-blue-100 text-blue-700",
  uber_eats: "bg-green-100 text-green-700",
  doordash: "bg-red-100 text-red-700",
};

const CHANNEL_LABELS: Record<string, string> = {
  loyverse: "Loyverse",
  uber_eats: "Uber Eats",
  doordash: "DoorDash",
};

const RESULT_COLORS: Record<string, string> = {
  success: "text-green-600",
  failed: "text-red-600",
  pending: "text-yellow-600",
  skipped: "text-gray-500",
};

// ── Main Component ─────────────────────────────────────────────────────────────

export function BagelAvailabilityClient({ initialData }: { initialData: BagelTypeWithState[] }) {
  const [bagels, setBagels] = useState<BagelState[]>(
    initialData.map((b) => ({ ...b, syncStatus: "idle" }))
  );
  const [globalMessage, setGlobalMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [voice, setVoice] = useState<VoiceState>({
    listening: false,
    transcript: "",
    preview: null,
    pendingCommand: null,
    error: null,
  });
  const [showMappings, setShowMappings] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // ── Helper: show a temporary message ──────────────────────────────────────

  const showMessage = useCallback((type: "success" | "error", text: string) => {
    setGlobalMessage({ type, text });
    setTimeout(() => setGlobalMessage(null), 4000);
  }, []);

  // ── Refresh data from API ──────────────────────────────────────────────────

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/bagel-availability");
      if (!res.ok) return;
      const fresh: BagelTypeWithState[] = await res.json();
      setBagels((prev) =>
        fresh.map((f) => {
          const existing = prev.find((p) => p.id === f.id);
          return { ...f, syncStatus: existing?.syncStatus === "syncing" ? "syncing" : "idle" };
        })
      );
    } catch {
      // silently ignore
    }
  }, []);

  // Auto-refresh every 8 seconds while any item is syncing
  useEffect(() => {
    const hasSyncing = bagels.some((b) => b.syncStatus === "syncing");
    if (!hasSyncing) return;
    const timer = setTimeout(refreshData, 8000);
    return () => clearTimeout(timer);
  }, [bagels, refreshData]);

  // ── Toggle handler ─────────────────────────────────────────────────────────

  const handleToggle = useCallback(async (bagelTypeId: string, isAvailable: boolean) => {
    setBagels((prev) =>
      prev.map((b) => (b.id === bagelTypeId ? { ...b, syncStatus: "syncing", isAvailable } : b))
    );

    try {
      const res = await fetch("/api/admin/bagel-availability/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bagelTypeId, isAvailable }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Toggle failed" }));
        showMessage("error", (err as { message?: string }).message ?? "Toggle failed");
        setBagels((prev) =>
          prev.map((b) => (b.id === bagelTypeId ? { ...b, syncStatus: "failed", isAvailable: !isAvailable } : b))
        );
        return;
      }

      setBagels((prev) =>
        prev.map((b) => (b.id === bagelTypeId ? { ...b, syncStatus: "syncing", isAvailable } : b))
      );

      // Refresh after a short delay to pick up sync results
      setTimeout(refreshData, 3000);
    } catch {
      showMessage("error", "Network error");
      setBagels((prev) =>
        prev.map((b) => (b.id === bagelTypeId ? { ...b, syncStatus: "failed" } : b))
      );
    }
  }, [showMessage, refreshData]);

  // ── All ON / All OFF ───────────────────────────────────────────────────────

  const handleAll = useCallback(async (isAvailable: boolean) => {
    setBagels((prev) => prev.map((b) => ({ ...b, syncStatus: "syncing", isAvailable })));
    try {
      const res = await fetch("/api/admin/bagel-availability/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, isAvailable }),
      });
      if (!res.ok) {
        showMessage("error", "Batch toggle failed");
        setBagels((prev) => prev.map((b) => ({ ...b, syncStatus: "failed" })));
        return;
      }
      showMessage("success", isAvailable ? "All bagels set to ON" : "All bagels set to OFF");
      setTimeout(refreshData, 3000);
    } catch {
      showMessage("error", "Network error");
    }
  }, [showMessage, refreshData]);

  // ── Restore ────────────────────────────────────────────────────────────────

  const handleRestore = useCallback(async (bagelTypeId: string) => {
    try {
      const res = await fetch("/api/admin/bagel-availability/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bagelTypeId }),
      });
      if (!res.ok) {
        showMessage("error", "Restore failed");
        return;
      }
      showMessage("success", "Restored previous state");
      await refreshData();
    } catch {
      showMessage("error", "Network error");
    }
  }, [showMessage, refreshData]);

  // ── Retry failed syncs ─────────────────────────────────────────────────────

  const handleRetry = useCallback(async (bagelTypeId?: string) => {
    try {
      await fetch("/api/admin/bagel-availability/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bagelTypeId ? { bagelTypeId } : {}),
      });
      showMessage("success", "Retrying failed syncs...");
      setTimeout(refreshData, 2000);
    } catch {
      showMessage("error", "Retry failed");
    }
  }, [showMessage, refreshData]);

  // ── Voice control ──────────────────────────────────────────────────────────

  const handleVoiceText = useCallback(async (text: string) => {
    try {
      const res = await fetch("/api/admin/bagel-availability/voice-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, confirmed: false }),
      });
      const data = (await res.json()) as { parsed: boolean; message?: string; preview?: string; command?: VoiceState["pendingCommand"] };
      if (!data.parsed) {
        setVoice((v) => ({ ...v, error: data.message ?? "Could not understand command", preview: null, pendingCommand: null }));
        return;
      }
      setVoice((v) => ({ ...v, preview: data.preview ?? null, pendingCommand: data.command ?? null, error: null }));
    } catch {
      setVoice((v) => ({ ...v, error: "Voice command processing failed" }));
    }
  }, []);

  const startListening = useCallback(() => {
    type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;
    const SpeechRecognitionImpl: SpeechRecognitionCtor | undefined =
      typeof window !== "undefined"
        ? ((window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
          (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition)
        : undefined;

    if (!SpeechRecognitionImpl) {
      setVoice((v) => ({ ...v, error: "Speech recognition not supported in this browser" }));
      return;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => setVoice((v) => ({ ...v, listening: true, error: null, transcript: "" }));
    recognition.onend = () => setVoice((v) => ({ ...v, listening: false }));
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      setVoice((v) => ({ ...v, listening: false, error: `Speech error: ${e.error}` }));
    };
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      setVoice((v) => ({ ...v, transcript, listening: false }));
      void handleVoiceText(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [handleVoiceText]);

  const confirmVoiceCommand = useCallback(async () => {
    if (!voice.pendingCommand) return;
    try {
      const res = await fetch("/api/admin/bagel-availability/voice-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: voice.transcript, confirmed: true }),
      });
      if (res.ok) {
        showMessage("success", `Voice: ${voice.preview}`);
        setVoice({ listening: false, transcript: "", preview: null, pendingCommand: null, error: null });
        setTimeout(refreshData, 2000);
      } else {
        showMessage("error", "Voice command failed");
      }
    } catch {
      showMessage("error", "Network error");
    }
  }, [voice, showMessage, refreshData]);

  const cancelVoiceCommand = useCallback(() => {
    setVoice({ listening: false, transcript: "", preview: null, pendingCommand: null, error: null });
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasAnyFailed = bagels.some((b) => b.channelStatuses.some((cs) => cs.lastResult === "failed"));

  return (
    <div className="space-y-4">
      {/* Global message */}
      {globalMessage && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${globalMessage.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {globalMessage.text}
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => void handleAll(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 active:scale-95 transition-all"
        >
          ✅ All ON
        </button>
        <button
          onClick={() => void handleAll(false)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 active:scale-95 transition-all"
        >
          ❌ All OFF
        </button>
        <button
          onClick={() => void refreshData()}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-200 active:scale-95 transition-all"
        >
          🔄 Refresh
        </button>
        {hasAnyFailed && (
          <button
            onClick={() => void handleRetry()}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg font-semibold text-sm hover:bg-amber-600 active:scale-95 transition-all"
          >
            ↩️ Retry Failed Syncs
          </button>
        )}
        <button
          onClick={() => setShowMappings((v) => !v)}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-200 active:scale-95 transition-all ml-auto"
        >
          {showMappings ? "🔼 Hide" : "⚙️ Channel Mappings"}
        </button>
      </div>

      {/* Voice control panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={startListening}
            disabled={voice.listening}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-base transition-all active:scale-95 ${
              voice.listening
                ? "bg-red-100 text-red-700 animate-pulse"
                : "bg-amber-500 text-white hover:bg-amber-600"
            }`}
          >
            🎤 {voice.listening ? "Listening..." : "Voice Command"}
          </button>
          {voice.transcript && (
            <span className="text-sm text-gray-500">Heard: <span className="font-medium text-gray-800">&ldquo;{voice.transcript}&rdquo;</span></span>
          )}
        </div>

        {/* Manual text fallback */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const input = form.elements.namedItem("voiceText") as HTMLInputElement;
            void handleVoiceText(input.value);
          }}
          className="flex gap-2"
        >
          <input
            name="voiceText"
            type="text"
            placeholder="Or type: sesame off / 세사미 꺼 / plain on"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button type="submit" className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900">
            Parse
          </button>
        </form>

        {voice.error && (
          <p className="text-sm text-red-600">{voice.error}</p>
        )}

        {/* Voice confirmation dialog */}
        {voice.preview && voice.pendingCommand && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
            <span className="text-sm font-semibold text-amber-900 flex-1">{voice.preview}</span>
            <button
              onClick={() => void confirmVoiceCommand()}
              className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
            >
              Confirm ✓
            </button>
            <button
              onClick={cancelVoiceCommand}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Bagel cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {bagels.map((bagel) => (
          <BagelCard
            key={bagel.id}
            bagel={bagel}
            onToggle={handleToggle}
            onRestore={handleRestore}
            onRetry={handleRetry}
          />
        ))}
      </div>

      {/* Channel Mappings panel */}
      {showMappings && <ChannelMappingsPanel />}
    </div>
  );
}

// ── BagelCard ──────────────────────────────────────────────────────────────────

function BagelCard({
  bagel,
  onToggle,
  onRestore,
  onRetry,
}: {
  bagel: BagelState;
  onToggle: (id: string, v: boolean) => void;
  onRestore: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const isSyncing = bagel.syncStatus === "syncing";
  const hasFailed = bagel.channelStatuses.some((cs) => cs.lastResult === "failed");

  return (
    <div className={`rounded-xl border-2 p-5 space-y-4 transition-all ${
      bagel.isAvailable
        ? "border-green-300 bg-green-50"
        : "border-red-300 bg-red-50"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{bagel.name}</h2>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          isSyncing
            ? "bg-yellow-100 text-yellow-700 animate-pulse"
            : bagel.isAvailable
            ? "bg-green-200 text-green-800"
            : "bg-red-200 text-red-800"
        }`}>
          {isSyncing ? "SYNCING" : bagel.isAvailable ? "ON" : "OFF"}
        </span>
      </div>

      {/* Last updated */}
      {bagel.lastChangedAt && (
        <p className="text-xs text-gray-500">
          Changed: {new Date(bagel.lastChangedAt).toLocaleString("en-NZ", { dateStyle: "short", timeStyle: "short" })}
        </p>
      )}

      {/* Toggle button */}
      <button
        onClick={() => onToggle(bagel.id, !bagel.isAvailable)}
        disabled={isSyncing}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50 ${
          bagel.isAvailable
            ? "bg-red-500 text-white hover:bg-red-600"
            : "bg-green-500 text-white hover:bg-green-600"
        }`}
      >
        {isSyncing ? "..." : bagel.isAvailable ? "Turn OFF" : "Turn ON"}
      </button>

      {/* Explicit ON / OFF buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onToggle(bagel.id, true)}
          disabled={isSyncing || bagel.isAvailable}
          className="py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          ✅ ON
        </button>
        <button
          onClick={() => onToggle(bagel.id, false)}
          disabled={isSyncing || !bagel.isAvailable}
          className="py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          ❌ OFF
        </button>
      </div>

      {/* Restore button */}
      <button
        onClick={() => onRestore(bagel.id)}
        className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
      >
        ↩ Restore last change
      </button>

      {/* Channel sync status */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sync Status</p>
        {bagel.channelStatuses.map((cs) => (
          <div key={cs.channel} className="flex items-center justify-between gap-1">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CHANNEL_COLORS[cs.channel] ?? "bg-gray-100 text-gray-600"}`}>
              {CHANNEL_LABELS[cs.channel] ?? cs.channel}
            </span>
            <div className="flex items-center gap-1">
              <span className={`text-xs font-medium ${RESULT_COLORS[cs.lastResult] ?? "text-gray-500"}`}>
                {cs.lastResult}
              </span>
              {cs.lastResult === "failed" && (
                <button
                  onClick={() => onRetry(bagel.id)}
                  className="text-xs text-amber-600 hover:text-amber-800 underline"
                  title={cs.lastError ?? undefined}
                >
                  retry
                </button>
              )}
            </div>
          </div>
        ))}
        {bagel.channelStatuses.length === 0 && (
          <p className="text-xs text-gray-400">No channel mappings yet</p>
        )}
      </div>

      {/* Show error if any */}
      {hasFailed && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {bagel.channelStatuses.find((cs) => cs.lastResult === "failed")?.lastError?.slice(0, 100) ?? "Sync failed"}
        </div>
      )}
    </div>
  );
}

// ── ChannelMappingsPanel ───────────────────────────────────────────────────────

interface MappingRow {
  id: string;
  bagelTypeId: string;
  channel: string;
  remoteEntityType: string;
  remoteEntityId: string;
  remoteMenuId: string | null;
  remoteStoreId: string | null;
  isEnabled: boolean;
  bagelType: { name: string; code: string };
}

interface BagelTypeSummary {
  id: string;
  name: string;
  code: string;
}

function ChannelMappingsPanel() {
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newMapping, setNewMapping] = useState({
    bagelTypeId: "",
    channel: "loyverse",
    remoteEntityType: "item",
    remoteEntityId: "",
    remoteMenuId: "",
    remoteStoreId: "",
  });
  const [bagelTypes, setBagelTypes] = useState<BagelTypeSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [mRes, bRes] = await Promise.all([
          fetch("/api/admin/bagel-availability/mappings"),
          fetch("/api/admin/bagel-availability"),
        ]);
        if (mRes.ok) setMappings((await mRes.json()) as MappingRow[]);
        if (bRes.ok) setBagelTypes((await bRes.json()) as BagelTypeSummary[]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const handleToggleEnabled = async (id: string, isEnabled: boolean) => {
    const res = await fetch(`/api/admin/bagel-availability/mappings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled }),
    });
    if (res.ok) {
      setMappings((prev) => prev.map((m) => (m.id === id ? { ...m, isEnabled } : m)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this mapping?")) return;
    const res = await fetch(`/api/admin/bagel-availability/mappings/${id}`, { method: "DELETE" });
    if (res.ok) setMappings((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const payload = {
        ...newMapping,
        remoteMenuId: newMapping.remoteMenuId || null,
        remoteStoreId: newMapping.remoteStoreId || null,
      };
      const res = await fetch("/api/admin/bagel-availability/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = (await res.json()) as MappingRow;
        const bt = bagelTypes.find((b) => b.id === newMapping.bagelTypeId);
        setMappings((prev) => [...prev, { ...created, bagelType: bt ?? { name: "", code: "" } }]);
        setMessage("Mapping created");
        setNewMapping({ bagelTypeId: "", channel: "loyverse", remoteEntityType: "item", remoteEntityId: "", remoteMenuId: "", remoteStoreId: "" });
      } else {
        const err = (await res.json().catch(() => ({ message: "Failed" }))) as { message?: string };
        setMessage(err.message ?? "Failed");
      }
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-500 p-4">Loading mappings...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">⚙️ Channel Mappings</h2>
      <p className="text-sm text-gray-500">
        Link each bagel type to the correct remote entity on each platform. Each mapping can target an item, option, or modifier depending on the platform setup.
      </p>

      {message && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">{message}</div>}

      {/* Existing mappings */}
      {mappings.length === 0 ? (
        <p className="text-sm text-gray-400">No mappings configured yet. Add one below.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="pb-2 pr-3">Bagel</th>
                <th className="pb-2 pr-3">Channel</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2 pr-3">Remote ID</th>
                <th className="pb-2 pr-3">Store ID</th>
                <th className="pb-2 pr-3">Enabled</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 pr-3 font-medium">{m.bagelType?.name ?? m.bagelTypeId}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CHANNEL_COLORS[m.channel] ?? ""}`}>
                      {CHANNEL_LABELS[m.channel] ?? m.channel}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-gray-600">{m.remoteEntityType}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{m.remoteEntityId}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-gray-500">{m.remoteStoreId ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <button
                      onClick={() => void handleToggleEnabled(m.id, !m.isEnabled)}
                      className={`text-xs px-2 py-0.5 rounded font-medium ${m.isEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {m.isEnabled ? "✓ Enabled" : "Disabled"}
                    </button>
                  </td>
                  <td className="py-2">
                    <button onClick={() => void handleDelete(m.id)} className="text-xs text-red-500 hover:text-red-700">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add new mapping form */}
      <form onSubmit={(e) => void handleAdd(e)} className="space-y-3 pt-3 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Add New Mapping</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Bagel Type</label>
            <select
              value={newMapping.bagelTypeId}
              onChange={(e) => setNewMapping((v) => ({ ...v, bagelTypeId: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">Select...</option>
              {bagelTypes.map((bt) => (
                <option key={bt.id} value={bt.id}>{bt.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Channel</label>
            <select
              value={newMapping.channel}
              onChange={(e) => setNewMapping((v) => ({ ...v, channel: e.target.value }))}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="loyverse">Loyverse</option>
              <option value="uber_eats">Uber Eats</option>
              <option value="doordash">DoorDash</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Entity Type</label>
            <select
              value={newMapping.remoteEntityType}
              onChange={(e) => setNewMapping((v) => ({ ...v, remoteEntityType: e.target.value }))}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="item">item</option>
              <option value="option">option</option>
              <option value="modifier_option">modifier_option</option>
              <option value="category_item">category_item</option>
              <option value="unknown">unknown</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Remote Entity ID *</label>
            <input
              type="text"
              value={newMapping.remoteEntityId}
              onChange={(e) => setNewMapping((v) => ({ ...v, remoteEntityId: e.target.value }))}
              required
              placeholder="remote-id-here"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Store ID (optional)</label>
            <input
              type="text"
              value={newMapping.remoteStoreId}
              onChange={(e) => setNewMapping((v) => ({ ...v, remoteStoreId: e.target.value }))}
              placeholder="store-id"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Menu ID (optional)</label>
            <input
              type="text"
              value={newMapping.remoteMenuId}
              onChange={(e) => setNewMapping((v) => ({ ...v, remoteMenuId: e.target.value }))}
              placeholder="menu-id"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={adding}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
        >
          {adding ? "Adding..." : "+ Add Mapping"}
        </button>
      </form>
    </div>
  );
}

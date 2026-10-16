import { useState, useEffect } from "react";
import { Code, Loader2, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";

export default function DeveloperSettings() {
  const [counts, setCounts] = useState(null);
  const [countsLoading, setCountsLoading] = useState(true);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState(null);
  const [error, setError] = useState("");

  const loadCounts = async () => {
    setCountsLoading(true);
    setError("");
    try {
      const res = await adminAPI.getOperationalDataCounts();
      setCounts(res?.data?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load record counts");
    } finally {
      setCountsLoading(false);
    }
  };

  useEffect(() => {
    loadCounts();
  }, []);

  const clearOperational = async () => {
    setClearing(true);
    setError("");
    setClearResult(null);
    try {
      const res = await adminAPI.clearOperationalData({ confirm: confirmPhrase });
      setClearResult(res?.data?.data || null);
      setConfirmPhrase("");
      toast.success("Operational data cleared");
      loadCounts();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not clear the data");
    } finally {
      setClearing(false);
    }
  };

  const confirmReady = Boolean(counts) && confirmPhrase === counts.confirmPhrase;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
          <Code className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Developer Settings</h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-0.5">Low-level maintenance tools. Super admin only.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden max-w-3xl">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-red-100">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <ShieldAlert className="h-5 w-5" /> Clear operational data
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Removes orders, payments, wallets, withdrawals, tickets and other activity created by using the app. Users, restaurants,
              delivery partners, admins, foods, categories, zones, offers, banners and settings are kept.
            </p>
          </div>
          <button
            type="button"
            onClick={loadCounts}
            disabled={countsLoading}
            aria-label="Refresh counts"
            className="text-slate-500 hover:text-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${countsLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {counts ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {counts.groups.map((g) => (
                <div key={g.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-xs text-slate-600">{g.label}</span>
                  <span className={`text-sm font-bold ${g.count ? "text-slate-900" : "text-slate-400"}`}>{g.count.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">{countsLoading ? "Loading counts..." : error || "No data"}</p>
          )}

          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">Total records</span>
            <span className="text-lg font-extrabold text-slate-900">{counts ? counts.total.toLocaleString("en-IN") : "—"}</span>
          </div>

          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-xs text-red-800">
              This cannot be undone. To continue, type <span className="font-mono font-bold">{counts?.confirmPhrase || "DELETE OPERATIONAL DATA"}</span> below.
            </p>
            <input
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder="Type the phrase to confirm"
              className="h-10 w-full rounded-lg border border-red-300 bg-white px-3 text-sm outline-none focus:border-red-500"
            />
            <button
              type="button"
              disabled={!confirmReady || clearing || !counts || counts.total === 0}
              onClick={clearOperational}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {clearing ? "Clearing..." : "Clear operational data"}
            </button>
            {counts?.total === 0 && <p className="text-center text-xs text-slate-500">There is no operational data to clear.</p>}
          </div>

          {error && counts && <p className="text-sm text-red-600">{error}</p>}
          {clearResult && (
            <p className="text-sm font-medium text-emerald-700">
              Cleared {clearResult.total.toLocaleString("en-IN")} records. Accounts and catalogue are unchanged.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

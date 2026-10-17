import { useState, useEffect } from "react";
import { AlertTriangle, Cloud, CloudUpload, CheckCircle2, HardDrive, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";

export default function ImageSetting() {
  const [uploadProvider, setUploadProvider] = useState("local");
  const [cloudinaryInfo, setCloudinaryInfo] = useState({ configured: false, nodeEnv: "", localUploadDir: "" });
  const [providerBusy, setProviderBusy] = useState(false);

  const loadUploadProvider = async () => {
    try {
      const res = await adminAPI.getUploadSettings();
      const data = res?.data?.data || {};
      setUploadProvider(data.imageUploadProvider || "local");
      setCloudinaryInfo({
        configured: Boolean(data.cloudinaryConfigured),
        nodeEnv: data.nodeEnv || "",
        localUploadDir: data.localUploadDir || "",
      });
    } catch {
      // keep defaults
    }
  };

  const handleProviderToggle = async (useCloudinaryProvider) => {
    if (providerBusy) return;
    if (useCloudinaryProvider && !cloudinaryInfo.configured) {
      toast.error("Cloudinary is not configured on the server (missing CLOUDINARY_* env vars)");
      return;
    }
    try {
      setProviderBusy(true);
      const res = await adminAPI.updateUploadSettings({
        imageUploadProvider: useCloudinaryProvider ? "cloudinary" : "local",
      });
      setUploadProvider(res?.data?.data?.imageUploadProvider || "local");
      toast.success(useCloudinaryProvider ? "New uploads will go to Cloudinary" : "New uploads will be saved locally");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update upload provider");
    } finally {
      setProviderBusy(false);
    }
  };

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUploadProvider().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="mb-4">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Image Setting</h1>
        <p className="text-xs lg:text-sm text-slate-500 mt-1">Control where uploaded images, videos and PDFs are stored.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                <CloudUpload className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Image Upload Storage</h3>
                <p className="text-xs text-slate-500 mt-0.5">Choose where newly uploaded images, videos and PDFs are stored.</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              <span className={`h-1.5 w-1.5 rounded-full ${cloudinaryInfo.nodeEnv === "production" ? "bg-emerald-500" : "bg-amber-500"}`} />
              Server mode: {cloudinaryInfo.nodeEnv || "development"}
            </span>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: "local", label: "Local Storage", Icon: HardDrive, desc: "Saved on this server's disk" },
                { key: "cloudinary", label: "Cloudinary", Icon: Cloud, desc: "Saved on Cloudinary (CDN-hosted)" },
              ].map(({ key, label, Icon, desc }) => {
                const active = uploadProvider === key;
                const disabled = key === "cloudinary" && !cloudinaryInfo.configured;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={providerBusy || disabled}
                    onClick={() => !active && handleProviderToggle(key === "cloudinary")}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed ${
                      active ? "border-blue-600 bg-blue-50/60 ring-1 ring-blue-600" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    } ${disabled ? "opacity-50" : ""}`}
                  >
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                      {disabled && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                          <AlertTriangle className="h-3 w-3" /> CLOUDINARY_* keys not set on server
                        </p>
                      )}
                    </div>
                    {providerBusy && !active ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    ) : (
                      active && <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-blue-600" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-semibold text-amber-800">How uploads are stored</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
                <div className="rounded-lg border border-amber-100 bg-white p-3">
                  <p className="font-semibold text-slate-900 mb-1">If Cloudinary is selected</p>
                  <p>Files are always stored on Cloudinary, whatever the server mode is. The server needs the <code className="rounded bg-slate-100 px-1">CLOUDINARY_*</code> keys.</p>
                </div>

                <div className="rounded-lg border border-amber-100 bg-white p-3">
                  <p className="font-semibold text-slate-900 mb-1">If Local is selected</p>
                  <p className="mb-2">Files are saved on the server's disk. The folder depends on the server mode (<code className="rounded bg-slate-100 px-1">NODE_ENV</code>):</p>
                  <ul className="space-y-1.5">
                    <li className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">Development</span>
                      <span className="text-slate-400">→</span>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5">Backend/uploads</code>
                    </li>
                    <li className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">Production</span>
                      <span className="text-slate-400">→</span>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5">/var/www/uploads</code>
                    </li>
                  </ul>
                </div>
              </div>

              <ul className="mt-3 space-y-1 text-[11px] text-slate-600">
                <li>• Files are stored flat — directly in the folder, with no subfolders.</li>
                <li>• Switching only affects new uploads; existing files stay where they are.</li>
                {cloudinaryInfo.localUploadDir && (
                  <li className="break-all">• Local folder in use right now: <code className="rounded bg-white px-1">{cloudinaryInfo.localUploadDir}</code></li>
                )}
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

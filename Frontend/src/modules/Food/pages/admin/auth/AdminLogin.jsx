import { useState, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { adminAPI } from "@food/api"
import { setAuthData } from "@food/utils/auth"
import { ShieldCheck, Network, ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, ShieldQuestion } from "lucide-react"
import logoNew from "@/assets/logo.png"
import { toast } from "sonner"

const fieldClass =
  "block w-full h-14 pl-13 pr-5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl outline-none transition " +
  "placeholder:text-slate-400 focus:bg-white focus:border-red-400 focus:ring-4 focus:ring-red-500/10"

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error("Please fill in all fields")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)

    try {
      const response = await adminAPI.login(email.trim(), password)
      const data = response?.data?.data || response?.data || {}

      const accessToken = data.accessToken
      const adminUser = data.user || data.admin
      const refreshToken = data.refreshToken ?? null

      if (!accessToken || !adminUser || !refreshToken) {
        throw new Error("Invalid response from server")
      }

      setAuthData("admin", accessToken, adminUser, refreshToken)
      toast.success(adminUser?.role === "FRANCHISE_OWNER" ? `Welcome, ${adminUser.name || "Franchise owner"}` : "Welcome, Administrator")
      navigate(adminUser?.role === "FRANCHISE_OWNER" ? "/franchise/food" : "/admin/food", { replace: true })
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Login failed. Check your credentials."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  return (
    <div
      className="min-h-dvh relative flex flex-col bg-[#fbf2e5] bg-cover bg-center font-['Poppins']"
      style={{ backgroundImage: "url(/admin-login-bg.jpg)" }}
    >
      <div className="absolute top-5 right-5 z-20">
        <Link
          to="/user/auth/support"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur text-sm font-semibold text-slate-600 hover:text-red-600 shadow-sm"
        >
          <ShieldQuestion className="w-4 h-4" />
          Support
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 [@media(max-height:860px)]:py-5">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-130 flex flex-col items-center"
        >
          {/* Logo & panel name. max-height variants keep the form above the fold on 768px-tall laptops. */}
          <img
            src={logoNew}
            alt="CityFood"
            className="w-40 h-40 sm:w-48 sm:h-48 [@media(max-height:860px)]:w-28 [@media(max-height:860px)]:h-28 rounded-full object-cover drop-shadow-[0_12px_24px_rgba(0,0,0,0.18)] select-none"
          />
          <p className="mt-2 mb-5 [@media(max-height:860px)]:mb-3 text-[13px] sm:text-sm font-semibold text-slate-700 uppercase tracking-[0.55em] pl-[0.55em]">
            Admin Panel
          </p>

          {/* Login card */}
          <div className="w-full bg-white rounded-[28px] px-6 py-8 sm:px-14 sm:py-12 [@media(max-height:860px)]:py-7 shadow-[0_30px_80px_-24px_rgba(140,70,20,0.35)] border border-white">
            <h1 className="text-3xl sm:text-[38px] font-extrabold tracking-tight text-slate-900 leading-tight">Admin Entry</h1>
            <div className="h-1 w-14 bg-red-600 rounded-full mt-3 mb-4" />
            <p className="text-base sm:text-lg text-slate-500 leading-relaxed">
              Authorized access only. Please sign in to continue.
            </p>

            <form onSubmit={handleLogin} className="mt-8 space-y-6 [@media(max-height:860px)]:mt-5 [@media(max-height:860px)]:space-y-4">
              <div>
                <label htmlFor="admin-email" className="block mb-2.5 text-xs sm:text-[13px] font-bold text-emerald-900 uppercase tracking-[0.18em]">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    id="admin-email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={fieldClass}
                    placeholder="admin@tuggo.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <label htmlFor="admin-password" className="text-xs sm:text-[13px] font-bold text-emerald-900 uppercase tracking-[0.18em]">
                    Password
                  </label>
                  <Link to="/admin/forgot-password" className="text-xs sm:text-[13px] font-bold text-red-600 hover:text-red-700 uppercase tracking-[0.12em]">
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${fieldClass} pr-14`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group w-full h-16 mt-2 flex items-center justify-center gap-3 rounded-xl bg-linear-to-b from-red-600 to-red-700 text-white text-lg sm:text-xl font-bold shadow-[0_14px_30px_-10px_rgba(220,38,38,0.65)] hover:brightness-110 active:scale-[0.99] transition disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <span>Enter Dashboard</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer badges */}
          <div className="mt-8 [@media(max-height:860px)]:mt-5 flex items-center justify-center gap-5 sm:gap-9 text-slate-600">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs sm:text-[13px] font-medium uppercase tracking-[0.15em]">Secure Access</span>
            </div>
            <div className="h-7 w-px bg-slate-300" />
            <div className="flex items-center gap-2.5">
              <Network className="w-5 h-5" />
              <span className="text-xs sm:text-[13px] font-medium uppercase tracking-[0.15em]">Admin Control</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

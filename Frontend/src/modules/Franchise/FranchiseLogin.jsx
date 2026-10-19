import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { Building2, Eye, EyeOff, Lock, LogIn, Mail, Phone } from "lucide-react"
import { franchiseAPI } from "@food/api"
import { isModuleAuthenticated, setAuthData } from "@food/utils/auth"
import { apiErrorMessage } from "@food/pages/admin/franchise/franchiseUi"
import { isFranchiseSession } from "@food/utils/adminSidebarMenu"

const fieldClass =
  "w-full h-12 pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-[15px] text-slate-900 placeholder:text-slate-400 " +
  "focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 transition"

export default function FranchiseLogin() {
  const navigate = useNavigate()
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  if (isModuleAuthenticated("admin")) return <Navigate to={isFranchiseSession() ? "/franchise/food" : "/admin/food"} replace />

  const submit = async (e) => {
    e.preventDefault()
    if (!login.trim() || !password) {
      setError("Enter your phone or email and password")
      return
    }
    try {
      setLoading(true)
      setError("")
      const res = await franchiseAPI.login(login.trim(), password)
      const { accessToken, refreshToken, user } = res?.data?.data || {}
      // The owner gets the same pages as HQ under /franchise; the backend scopes them to the franchise zone.
      setAuthData("admin", accessToken, user, refreshToken)
      window.dispatchEvent(new Event("adminAuthChanged"))
      navigate("/franchise/food", { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, "Could not log in. Please try again."))
    } finally {
      setLoading(false)
    }
  }

  const LoginIcon = login.includes("@") ? Mail : Phone

  return (
    <div
      className="relative min-h-dvh flex items-center justify-center px-4 py-8 bg-[#faf1e4] bg-cover bg-center"
      style={{ backgroundImage: "url(/franchise-login-bg.jpg)" }}
    >
      <div className="relative w-full max-w-115 flex flex-col items-center">
        {/* Logo badge overlapping the card */}
        <img
          src="/logo.png"
          alt="CityFood"
          className="relative z-10 w-36 h-36 sm:w-44 sm:h-44 -mb-10 sm:-mb-12 rounded-full object-cover drop-shadow-[0_10px_24px_rgba(0,0,0,0.18)] select-none"
          onError={(e) => { e.currentTarget.style.display = "none" }}
        />

        <form
          onSubmit={submit}
          className="w-full bg-white/95 backdrop-blur-sm border border-white rounded-[28px] shadow-[0_24px_70px_-20px_rgba(120,72,20,0.35)] px-6 sm:px-11 pt-16 sm:pt-18 pb-8 flex flex-col gap-5"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 shrink-0 rounded-2xl bg-linear-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-600/25">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-900 leading-tight">Franchise login</h1>
              <p className="text-[15px] text-slate-500">Manage your city on CityFood</p>
            </div>
          </div>

          <div>
            <label htmlFor="fl-login" className="block text-[15px] font-bold text-slate-800 mb-2">Phone or email</label>
            <div className="relative">
              <LoginIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                id="fl-login"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className={fieldClass}
                placeholder="10 digit phone"
              />
            </div>
          </div>

          <div>
            <label htmlFor="fl-password" className="block text-[15px] font-bold text-slate-800 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                id="fl-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${fieldClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              >
                {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-14 flex items-center justify-center gap-2.5 rounded-xl bg-linear-to-r from-emerald-600 to-green-500 text-white text-lg font-bold shadow-lg shadow-emerald-600/30 hover:brightness-105 active:scale-[0.99] transition disabled:opacity-60"
          >
            <LogIn className="w-5 h-5" />
            {loading ? "Logging in..." : "Log in"}
          </button>

          <p className="text-[13px] leading-relaxed text-slate-500">
            You can also sign in on the admin login page with your owner email. Forgot your password? Ask HQ to reset it.
          </p>
        </form>
      </div>
    </div>
  )
}

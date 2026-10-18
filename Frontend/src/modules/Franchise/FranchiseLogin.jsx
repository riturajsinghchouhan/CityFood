import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { Building2, LogIn } from "lucide-react"
import { franchiseAPI } from "@food/api"
import { isModuleAuthenticated, setAuthData } from "@food/utils/auth"
import { apiErrorMessage } from "@food/pages/admin/franchise/franchiseUi"
import { isFranchiseSession } from "@food/utils/adminSidebarMenu"

export default function FranchiseLogin() {
  const navigate = useNavigate()
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
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

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Franchise login</h1>
            <p className="text-sm text-slate-500">Manage your city on CityFood</p>
          </div>
        </div>
        <div>
          <label htmlFor="fl-login" className="block text-sm font-medium text-slate-700 mb-1">Phone or email</label>
          <input
            id="fl-login"
            autoComplete="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="10 digit phone"
          />
        </div>
        <div>
          <label htmlFor="fl-password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            id="fl-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading} className="flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-60">
          <LogIn className="w-4 h-4" />
          {loading ? "Logging in..." : "Log in"}
        </button>
        <p className="text-xs text-slate-500 text-center">You can also sign in on the admin login page with your owner email. Forgot your password? Ask HQ to reset it.</p>
      </form>
    </div>
  )
}

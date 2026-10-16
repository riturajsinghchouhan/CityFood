import { useState, useRef, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  Smartphone,
  ChevronDown,
  ArrowRight,
  Headphones,
  Loader2,
  CheckCircle2,
  X
} from "lucide-react"
import { toast } from "sonner"
import { deliveryAPI } from "@food/api"
import { clearModuleAuth } from "@food/utils/auth"
import { useAppLogo } from "@food/hooks/useAppLogo"
import logoNew from "@/assets/logo.png"

const DEFAULT_COUNTRY_CODE = "+91"

export default function DeliverySignIn() {
  const logoUrl = useAppLogo("delivery_app") || "/logo.png" || logoNew
  const navigate = useNavigate()
  const phoneInputRef = useRef(null)

  const [phone, setPhone] = useState(() => {
    const draft = localStorage.getItem("delivery_draft_phone")
    if (draft) return draft
    const stored = localStorage.getItem("deliveryAuthData")
    if (stored) {
      try {
        const data = JSON.parse(stored)
        return data.phone ? data.phone.replace("+91", "").trim() : ""
      } catch (e) {
        return ""
      }
    }
    return ""
  })
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)

  // iOS Safari keyboard scroll fix
  useEffect(() => {
    const handleFocus = () => {
      if (
        typeof window !== "undefined" &&
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !window.MSStream
      ) {
        setTimeout(() => {
          window.scrollTo(0, 0)
        }, 50)
      }
    }
    const inputs = document.querySelectorAll('input[type="tel"], input[type="text"]')
    inputs.forEach((input) => input.addEventListener("focus", handleFocus))
    return () => {
      inputs.forEach((input) => input.removeEventListener("focus", handleFocus))
    }
  }, [])

  const validatePhone = (num) => {
    const digits = num.replace(/\D/g, "")
    return digits.length === 10 && ["6", "7", "8", "9"].includes(digits[0])
  }

  const isValidNumber = validatePhone(phone)

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault()
    if (!validatePhone(phone)) {
      toast.error("Please enter a valid 10-digit mobile number")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)

    const fullPhone = `${DEFAULT_COUNTRY_CODE} ${phone}`.trim()

    try {
      clearModuleAuth("delivery")
      await deliveryAPI.sendOTP(fullPhone, "login")

      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        purpose: "login",
        module: "delivery",
      }
      localStorage.setItem("deliveryAuthData", JSON.stringify(authData))
      toast.success("Verification code sent to your phone!")
      navigate("/food/delivery/otp")
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to send OTP."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F1EA] text-[#1e293b] flex justify-center items-center relative overflow-x-hidden font-['Poppins'] select-none">
      {/* iOS Keyboard Fix & Focus Outline Reset */}
      <style>{`
        @supports (-webkit-touch-callout: none) {
          body, html {
            height: -webkit-fill-available;
            overscroll-behavior-y: none;
          }
          .min-h-screen {
            min-height: -webkit-fill-available !important;
          }
          input:focus {
            scroll-margin-bottom: 50vh;
          }
        }
        input, input:focus, input:focus-visible {
          outline: none !important;
          box-shadow: none !important;
          border: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          appearance: none !important;
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0px 1000px white inset !important;
        }
      `}</style>

      {/* Main Container constrained to mobile app layout on desktop */}
      <div className="w-full max-w-[430px] min-h-screen bg-gradient-to-b from-[#FFFDF9] via-[#FDF9F2] to-[#FFFBF5] sm:shadow-[0_20px_60px_rgba(0,0,0,0.08)] relative flex flex-col justify-between px-6 pt-7 pb-6 overflow-hidden">
        
        {/* --- Decorative Floating Graphics & Dotted Paths --- */}
        {/* Pizza Slice (Top-Left) with curved dotted trajectory */}
        <motion.div
          animate={{ y: [0, -6, 0], rotate: [0, 4, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-10 left-6 pointer-events-none z-10"
        >
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
            {/* Pizza Crust & Cheese */}
            <path
              d="M10 12 C18 10, 30 10, 38 14 L24 40 Z"
              fill="#FDBA74"
              stroke="#FB923C"
              strokeWidth="2"
            />
            <path
              d="M12 13 C18 11.5, 28 11.5, 36 15 L24 38 Z"
              fill="#FDE68A"
            />
            {/* Pepperoni & Toppings */}
            <circle cx="21" cy="20" r="2.5" fill="#EF4444" />
            <circle cx="27" cy="24" r="2" fill="#EF4444" />
            <circle cx="23" cy="29" r="2" fill="#EF4444" />
            <circle cx="17" cy="16" r="1.5" fill="#22C55E" />
            <circle cx="31" cy="18" r="1.5" fill="#22C55E" />
          </svg>
        </motion.div>

        {/* Dotted curve connecting Pizza towards Center */}
        <svg
          className="absolute top-16 left-12 w-32 h-20 pointer-events-none opacity-40"
          viewBox="0 0 120 80"
          fill="none"
        >
          <path
            d="M5 10 Q 50 60 110 50"
            stroke="#D6C5B3"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        </svg>

        {/* Orange Location Pin (Top-Right) */}
        <motion.div
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute top-24 right-9 pointer-events-none z-10"
        >
          <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
            <path
              d="M14 0 C6.268 0 0 6.268 0 14 C0 24.5 14 36 14 36 C14 36 28 24.5 28 14 C28 6.268 21.732 0 14 0 Z"
              fill="#F97316"
            />
            <circle cx="14" cy="14" r="5" fill="#FFFFFF" />
          </svg>
        </motion.div>

        {/* Dotted curve connecting Location Pin */}
        <svg
          className="absolute top-28 right-16 w-32 h-24 pointer-events-none opacity-40"
          viewBox="0 0 120 90"
          fill="none"
        >
          <path
            d="M110 10 Q 60 70 5 60"
            stroke="#D6C5B3"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        </svg>

        {/* Golden Cloche Serving Cover (Middle-Right) */}
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-36 right-16 pointer-events-none opacity-70 z-10"
        >
          <svg width="42" height="28" viewBox="0 0 44 32" fill="none">
            {/* Cloche Handle */}
            <circle cx="22" cy="5" r="3" fill="#FDBA74" />
            {/* Cloche Dome */}
            <path
              d="M6 24 C6 13, 14 8, 22 8 C30 8, 38 13, 38 24 Z"
              fill="#FED7AA"
              stroke="#FDBA74"
              strokeWidth="1.5"
            />
            {/* Plate Base */}
            <rect x="2" y="24" width="40" height="3" rx="1.5" fill="#FDBA74" />
          </svg>
        </motion.div>

        {/* --- Top Section: Circular CityFood Delivery Badge --- */}
        <div className="relative z-20 flex flex-col items-center pt-1">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)] border-4 border-white overflow-hidden p-1 flex items-center justify-center relative mb-3 group"
          >
            <img
              src={logoUrl}
              alt="CityFood Delivery Logo"
              className="w-full h-full object-contain filter drop-shadow select-none pointer-events-none group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.src = "/logo.png"
              }}
            />
          </motion.div>

          {/* Typography Section (Exact Copy & Styling from Image) */}
          <div className="text-center px-2">
            <h1 className="text-[26px] sm:text-[30px] font-black text-[#1e293b] leading-[1.15] tracking-tight font-['Outfit']">
              Deliver smiles.
            </h1>
            <h1 className="text-[26px] sm:text-[30px] font-black text-[#0f766e] leading-[1.15] tracking-tight font-['Outfit']">
              Earn on your schedule.
            </h1>
            <h2 className="text-[19px] sm:text-[21px] font-bold text-[#1e293b] tracking-tight mt-2.5">
              Delivery Partner Login
            </h2>
            <p className="text-[13px] sm:text-[14px] text-[#64748b] font-medium leading-snug mt-1 max-w-[240px] mx-auto">
              Login with your mobile number to continue
            </p>
          </div>
        </div>

        {/* --- Middle Section: Scooter Rider & Scenic Landscape Background (Exact Match to User Reference) --- */}
        <div className="relative -mx-6 w-[calc(100%+3rem)] flex items-center justify-center my-0 select-none overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full flex items-center justify-center relative"
          >
            <img
              src="/delivery-hero-clean.png"
              alt="CityFood Delivery Partner"
              className="w-full h-auto object-cover select-none pointer-events-none drop-shadow-sm"
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.src = "/delivery-hero-seamless.png"
              }}
            />
          </motion.div>
        </div>

        {/* --- Bottom Section: Form, Action Buttons & Support --- */}
        <div className="relative z-20 w-full space-y-3.5">
          <form onSubmit={handleSendOTP} className="space-y-3.5">
            {/* Pill-shaped Floating White Input Field */}
            <div className="w-full bg-white rounded-full shadow-[0_4px_22px_rgba(0,0,0,0.06)] border border-gray-100/90 px-4 py-3 sm:py-3.5 flex items-center transition-all focus-within:shadow-[0_6px_28px_rgba(0,180,216,0.18)] focus-within:border-[#00bfa5]/40">
              
              {/* Country Code Prefix */}
              <div className="flex items-center gap-1.5 pl-1 pr-2.5 shrink-0 select-none">
                <img
                  src="https://flagcdn.com/w40/in.png"
                  alt="India Flag"
                  className="w-5 h-auto rounded-[2px] shadow-xs object-cover"
                />
                <span className="text-[15px] font-bold text-[#1e293b] tracking-tight">
                  +91
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500 stroke-[2.2]" />
              </div>

              {/* Vertical Subtle Divider */}
              <div className="h-6 w-[1.5px] bg-gray-200 mx-2 shrink-0" />

              {/* Smartphone Outline Icon */}
              <Smartphone className="w-[18px] h-[18px] text-gray-400 mr-2 shrink-0 stroke-[2]" />

              {/* Input */}
              <input
                ref={phoneInputRef}
                type="tel"
                required
                autoComplete="off"
                spellCheck="false"
                inputMode="numeric"
                value={phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 10)
                  setPhone(val)
                  localStorage.setItem("delivery_draft_phone", val)
                }}
                maxLength={10}
                placeholder="9755633147"
                style={{ outline: "none", boxShadow: "none", border: "none" }}
                className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-[#1e293b] font-bold text-base sm:text-[17px] tracking-wider placeholder:text-gray-300 placeholder:font-medium placeholder:tracking-normal min-w-0"
              />

              {/* Clear / Valid Status */}
              {phone.length > 0 && (
                <div className="pr-1 shrink-0 flex items-center">
                  {isValidNumber ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 stroke-[2.5]" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPhone("")}
                      className="p-1 rounded-full text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Vibrant Cyan-to-Emerald Gradient CTA Button */}
            <button
              type="submit"
              disabled={loading || !isValidNumber}
              className="w-full py-4 rounded-full font-bold text-white text-[16px] sm:text-[17px] tracking-wide bg-gradient-to-r from-[#00A896] via-[#02C39A] to-[#05D59C] hover:brightness-105 active:scale-[0.98] shadow-[0_12px_26px_-6px_rgba(2,195,154,0.45)] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center relative overflow-hidden group cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Sending OTP...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center w-full relative">
                  <span>Send OTP to Register/Login</span>
                  
                  {/* Circular Arrow Badge */}
                  <div className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center ml-2.5 shrink-0 group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="w-4 h-4 text-white stroke-[2.8]" />
                  </div>
                </div>
              )}
            </button>
          </form>

          {/* Secondary Pill Button: Need Help? Support */}
          <div className="flex justify-center pt-1">
            <Link
              to="/food/delivery/support"
              className="w-full max-w-[270px] py-2.5 px-6 rounded-full border border-[#0f172a]/20 bg-white/90 hover:bg-white text-[#0f172a] font-bold text-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all flex items-center justify-center gap-2 active:scale-95 group"
            >
              <Headphones className="w-4 h-4 text-[#0f172a] stroke-[2.2] group-hover:rotate-6 transition-transform" />
              <span>Need Help? Support</span>
            </Link>
          </div>

          {/* Footer Terms & Privacy Policy */}
          <div className="text-center pt-2">
            <p className="text-[11px] sm:text-xs text-gray-500 font-medium leading-relaxed">
              By continuing, you agree to our <br className="sm:hidden" />
              <Link
                to="/food/delivery/profile/terms"
                className="text-[#0f766e] font-bold hover:underline mx-1"
              >
                Terms
              </Link>
              &
              <Link
                to="/food/delivery/profile/privacy"
                className="text-[#0f766e] font-bold hover:underline ml-1"
              >
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

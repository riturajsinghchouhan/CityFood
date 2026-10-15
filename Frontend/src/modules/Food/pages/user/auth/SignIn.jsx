import React, { useState, useEffect, useRef } from "react"
import { useNavigate, Link, useSearchParams } from "react-router-dom"
import {
  Smartphone,
  ArrowRight,
  Loader2,
  Headphones,
  ChevronDown,
  AlertCircle
} from "lucide-react"
import { motion } from "framer-motion"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { authAPI } from "@food/api"

// Botanical Leaf Component
const BotanicalLeaf = ({ className = "w-8 h-8", rotate = 0, opacity = 0.85 }) => (
  <svg
    viewBox="0 0 64 64"
    className={className}
    style={{ transform: `rotate(${rotate}deg)`, opacity }}
  >
    <defs>
      <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4ADE80" />
        <stop offset="50%" stopColor="#22C55E" />
        <stop offset="100%" stopColor="#15803D" />
      </linearGradient>
      <filter id="leafShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="1" dy="3" stdDeviation="3" floodColor="#14532D" floodOpacity="0.25" />
      </filter>
    </defs>
    <path
      d="M12 52 C 16 32, 34 16, 56 10 C 52 30, 36 48, 12 52 Z"
      fill="url(#leafGrad)"
      filter="url(#leafShadow)"
    />
    <path
      d="M14 50 Q 32 30 52 14"
      stroke="#166534"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.6"
      fill="none"
    />
    <path d="M26 38 Q 32 34 36 36" stroke="#166534" strokeWidth="1" strokeLinecap="round" opacity="0.4" fill="none" />
    <path d="M36 28 Q 42 24 46 26" stroke="#166534" strokeWidth="1" strokeLinecap="round" opacity="0.4" fill="none" />
  </svg>
)

export default function SignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
  })

  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    const draft = sessionStorage.getItem("user_draft_phone")
    if (draft) {
      setFormData((prev) => ({ ...prev, phone: draft }))
    }

    const stored = sessionStorage.getItem("userAuthData")
    if (!stored) return

    try {
      const data = JSON.parse(stored)
      const fullPhone = String(data.phone || "").trim()
      const phoneDigits = fullPhone.replace(/^\+91\s*/, "").replace(/\D/g, "").slice(0, 10)

      setFormData((prev) => ({
        ...prev,
        phone: phoneDigits || prev.phone,
      }))
    } catch (err) {}
  }, [])

  const validatePhone = (phone) => {
    if (!phone.trim()) return "Phone number is required"
    const cleanPhone = phone.replace(/\D/g, "")
    if (!/^\d{10}$/.test(cleanPhone)) return "Please enter a valid 10-digit number"
    return ""
  }

  const handleChange = (e) => {
    let { value } = e.target
    value = value.replace(/\D/g, "").slice(0, 10)
    setError(validatePhone(value))
    setFormData((prev) => ({ ...prev, phone: value }))
    sessionStorage.setItem("user_draft_phone", value)
  }

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const phoneError = validatePhone(formData.phone)
    setError(phoneError)
    if (phoneError) return
    if (submittingRef.current) return
    submittingRef.current = true
    setIsLoading(true)
    setError("")

    try {
      const countryCode = formData.countryCode?.trim() || "+91"
      const phoneDigits = String(formData.phone ?? "").replace(/\D/g, "").slice(0, 10)
      if (phoneDigits.length !== 10) {
        setError("Please enter a valid 10-digit number")
        setIsLoading(false)
        submittingRef.current = false
        return
      }
      const fullPhone = `${countryCode} ${phoneDigits}`
      await authAPI.sendOTP(fullPhone, "login", null)

      const ref = String(searchParams.get("ref") || "").trim()
      const authData = {
        method: "phone",
        phone: fullPhone,
        email: null,
        name: null,
        referralCode: ref || null,
        isSignUp: false,
        module: "user",
      }

      sessionStorage.setItem("userAuthData", JSON.stringify(authData))
      navigate("/food/user/auth/otp")
    } catch (apiError) {
      const message =
        apiError?.response?.data?.message ||
        apiError?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
      submittingRef.current = false
    }
  }

  const floatingAnimation = (delay = 0, duration = 4, yOffset = 8) => ({
    y: [-yOffset, yOffset],
    transition: {
      duration,
      repeat: Infinity,
      repeatType: "reverse",
      ease: "easeInOut",
      delay,
    },
  })

  return (
    <AnimatedPage className="min-h-screen bg-[#FBF9F5] flex justify-center items-center relative overflow-x-hidden selection:bg-red-500 selection:text-white font-sans">
      <div className="w-full max-w-[430px] min-h-screen sm:min-h-[920px] bg-[#FAF7F2] sm:shadow-[0_20px_60px_rgba(0,0,0,0.06)] relative flex flex-col justify-between overflow-hidden">
        
        {/* --- Background Delicate Doodles --- */}
        <div className="absolute top-8 left-8 pointer-events-none opacity-25">
          <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="#2D3748" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 22h20L12 2z" />
            <circle cx="12" cy="14" r="1.5" />
            <circle cx="9" cy="18" r="1" />
            <circle cx="15" cy="18" r="1" />
          </svg>
        </div>

        <div className="absolute top-16 right-7 pointer-events-none opacity-20">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#2D3748" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11h16a1 1 0 0 0 1-1A6 6 0 0 0 3 10a1 1 0 0 0 1 1z" />
            <path d="M3 14h18" />
            <path d="M4 17h16a2 2 0 0 1 2 2 1 1 0 0 1-1 1H3a1 1 0 0 1-1-1 2 2 0 0 1 2-2z" />
          </svg>
        </div>

        <div className="absolute top-[380px] left-4 pointer-events-none opacity-20">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#2D3748" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11h16a1 1 0 0 0 1-1A6 6 0 0 0 3 10a1 1 0 0 0 1 1z" />
            <path d="M3 14h18" />
            <path d="M4 17h16a2 2 0 0 1 2 2 1 1 0 0 1-1 1H3a1 1 0 0 1-1-1 2 2 0 0 1 2-2z" />
          </svg>
        </div>

        <div className="absolute top-[330px] right-6 pointer-events-none opacity-25">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#2D3748" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 2v20M21 2v6a3 3 0 0 1-3 3M15 2v6a3 3 0 0 0 3 3" />
            <path d="M6 2v20M3 2v6a3 3 0 0 0 6 0V2" />
          </svg>
        </div>

        {/* Realistic Floating Green Leaves */}
        <motion.div animate={floatingAnimation(0, 4.5, 6)} className="absolute top-18 left-3 pointer-events-none">
          <BotanicalLeaf className="w-10 h-10" rotate={-35} opacity={0.9} />
        </motion.div>
        
        <div className="absolute top-25 left-12 w-2 h-1 bg-[#EF4444] rounded-full rotate-45 opacity-80" />
        <div className="absolute top-27 left-8 w-2 h-1 bg-[#22C55E] rounded-full rotate-[-30deg] opacity-80" />

        <motion.div animate={floatingAnimation(1, 5, 8)} className="absolute top-52 right-4 pointer-events-none">
          <BotanicalLeaf className="w-8 h-8" rotate={35} opacity={0.85} />
        </motion.div>

        <motion.div animate={floatingAnimation(2, 4, 7)} className="absolute bottom-[350px] left-3 pointer-events-none">
          <BotanicalLeaf className="w-9 h-9" rotate={-15} opacity={0.9} />
        </motion.div>

        <motion.div animate={floatingAnimation(1.5, 5.5, 6)} className="absolute bottom-[400px] right-3 pointer-events-none">
          <BotanicalLeaf className="w-10 h-10" rotate={45} opacity={0.9} />
        </motion.div>

        {/* --- Top Bar: SUPPORT Button --- */}
        <div className="w-full px-6 pt-6 pb-2 flex items-center justify-end relative z-20">
          <Link
            to="/user/auth/support"
            className="bg-white px-4 py-1.5 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-gray-100 flex items-center gap-2 hover:shadow-md transition-all active:scale-95 group"
          >
            <Headphones className="w-4 h-4 text-[#F97316] stroke-[2.5]" />
            <span className="text-[#1E293B] font-extrabold text-[12px] tracking-wider uppercase">SUPPORT</span>
          </Link>
        </div>

        {/* --- Main Content Area --- */}
        <div className="w-full px-6 flex-1 flex flex-col items-center justify-center relative z-20 pt-1 pb-4">
          
          {/* Circular CityFood Badge Logo */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring", bounce: 0.35 }}
            className="w-44 h-44 sm:w-48 sm:h-48 mb-5 relative flex items-center justify-center rounded-full overflow-hidden shadow-[0_12px_28px_rgba(0,0,0,0.08)] bg-white"
          >
            <img
              src="/logo.png"
              alt="CityFood Logo"
              className="w-full h-full object-cover scale-[1.04] select-none pointer-events-none transition-transform hover:scale-108 duration-300"
              onError={(e) => {
                e.target.onerror = null
                e.target.src = "/favicon.ico"
              }}
            />
          </motion.div>

          {/* Heading Section */}
          <motion.div
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-center w-full mb-6"
          >
            <h1 className="text-[34px] sm:text-[38px] font-extrabold tracking-[-0.03em] leading-[1.12] text-[#0A4D27]">
              Delicious food
            </h1>
            <div className="text-[34px] sm:text-[38px] font-extrabold tracking-[-0.03em] leading-[1.12] text-[#E52E2E] flex items-center justify-center gap-2 mt-0.5">
              <span>Delivered fast</span>
              <span className="inline-block transform hover:rotate-12 transition-transform text-[32px] cursor-default select-none">🍕</span>
            </div>
            <p className="text-[#6B7280] font-medium text-[15px] sm:text-[16px] mt-2">
              Login with your mobile number
            </p>
          </motion.div>

          {/* Form Section */}
          <div className="w-full max-w-[360px]">
            <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
              {/* Phone Input Pill */}
              <div className="w-full h-[58px] bg-white rounded-full shadow-[0_4px_22px_rgba(0,0,0,0.06)] border border-gray-100/90 px-4 flex items-center transition-all focus-within:shadow-[0_8px_30px_rgba(229,46,46,0.12)] focus-within:border-red-300">
                {/* Country Selector IN ⌄ */}
                <div className="flex items-center gap-1 cursor-pointer select-none">
                  <span className="font-bold text-[#111827] text-[15px] tracking-wide">IN</span>
                  <ChevronDown className="w-4 h-4 text-gray-500 stroke-[2.2]" />
                </div>

                {/* Vertical Divider */}
                <div className="h-6 w-[1px] bg-gray-200 mx-3 shrink-0" />

                {/* Smartphone Outline Icon */}
                <Smartphone className="w-5 h-5 text-gray-400 mr-2.5 shrink-0 stroke-[1.8]" />

                {/* Prefix & Input */}
                <div className="flex items-center flex-1 min-w-0">
                  <span className="font-semibold text-gray-700 text-[15px] mr-1.5 shrink-0">+91</span>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    placeholder="9755633314"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full bg-transparent border-none outline-none text-[#111827] font-semibold text-[16px] tracking-wider placeholder:text-gray-400 placeholder:font-normal p-0"
                    autoComplete="tel-national"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center justify-center gap-1 text-xs text-red-500 font-medium mt-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Send OTP Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[56px] rounded-full bg-[#E52E2E] hover:bg-[#D92323] text-white font-bold text-[17px] shadow-[0_12px_28px_rgba(229,46,46,0.36)] hover:shadow-[0_16px_34px_rgba(229,46,46,0.46)] hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                ) : (
                  <>
                    <span>Send OTP</span>
                    <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                  </>
                )}
              </button>

              {/* Terms & Privacy Policy */}
              <p className="text-[12px] sm:text-[13px] text-[#6B7280] font-normal text-center mt-4">
                By continuing, you agree to our{" "}
                <Link
                  to="/profile/terms"
                  className="text-[#0A4D27] font-bold underline decoration-[#0A4D27]/40 underline-offset-2 hover:text-[#064E3B] transition-colors"
                >
                  Terms & Privacy Policy
                </Link>
              </p>
            </form>
          </div>
        </div>

        {/* --- Bottom Graphic Banner --- */}
        <div className="w-full relative z-10 leading-none select-none pointer-events-none mt-auto">
          <img
            src="/food/login-bottom-banner.png"
            alt="CityFood - Good Food, Fast Delivery, Better Tomorrow"
            className="w-full object-cover object-top block drop-shadow-sm"
          />
        </div>
      </div>
    </AnimatedPage>
  )
}

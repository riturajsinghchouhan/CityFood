import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link, useNavigate } from "react-router-dom"
import {
  Smartphone,
  ArrowRight,
  Loader2,
  Headphones,
  ChevronDown,
  RotateCcw,
  Edit2,
  CheckCircle2
} from "lucide-react"
import { toast } from "sonner"
import { authAPI, userAPI } from "@food/api"
import { setAuthData } from "@food/utils/auth"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"

// Beautiful Botanical Leaf Component
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

export default function UnifiedOTPFastLogin() {
  const RESEND_COOLDOWN_SECONDS = 60
  const [phoneNumber, setPhoneNumber] = useState(() => sessionStorage.getItem("draft_phone_login") || "")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [tempAuth, setTempAuth] = useState(null)
  const [pendingVerify, setPendingVerify] = useState(null)
  const navigate = useNavigate()
  const submitting = useRef(false)

  const normalizedPhone = () => {
    const digits = String(phoneNumber).replace(/\D/g, "").slice(-15)
    return digits.length >= 8 ? digits : ""
  }

  const handleSendOTP = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const phone = normalizedPhone()
    if (phone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtp("")
      setStep(2)
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP sent successfully!")
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to send OTP."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleResendOTP = async () => {
    const phone = normalizedPhone()
    if (phone.length < 10) {
      toast.error("Please enter a valid phone number")
      return
    }
    if (resendTimer > 0 || submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtp("")
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP resent successfully.")
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to resend OTP."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleEditNumber = () => {
    setStep(1)
    setOtp("")
    setResendTimer(0)
    setPendingVerify(null)
    setShowNameModal(false)
    setNewName("")
  }

  const handleVerifyOTP = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const otpDigits = String(otp).replace(/\D/g, "").slice(0, 6)
    if (otpDigits.length !== 6) {
      toast.error("Please enter the 6-digit OTP")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    let fcmToken = null
    let platform = "web"
    try {
      try {
        if (typeof window !== "undefined") {
          if (window.flutter_inappwebview) {
            platform = "mobile"
            const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"]
            for (const handlerName of handlerNames) {
              try {
                const t = await window.flutter_inappwebview.callHandler(handlerName, { module: "user" })
                if (t && typeof t === "string" && t.length > 20) {
                  fcmToken = t.trim()
                  break
                }
              } catch (e) {}
            }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null
          }
        }
      } catch (e) {
        console.warn("Failed to get FCM token during login", e)
      }

      const response = await authAPI.verifyOTP(phoneNumber, otpDigits, "login", null, null, "user", null, null, fcmToken, platform)
      const data = response?.data?.data || response?.data || {}
      const needsName = data.needsName === true || data.isNewUser === true || (data.user && (!data.user.name || String(data.user.name).trim().length === 0 || String(data.user.name).toLowerCase() === "null"))

      if (needsName) {
        setPendingVerify({ phone: phoneNumber, otp: otpDigits, fcmToken, platform })
        setShowNameModal(true)
        return
      }

      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }

      setAuthData("user", accessToken, user, refreshToken)
      toast.success("Welcome back!")
      navigate("/food/user", { replace: true })
    } catch (err) {
      const status = err?.response?.status
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Invalid OTP. Please try again."
      const nameRequired = /name\s+is\s+required.*first[- ]?time|first[- ]?time.*name\s+is\s+required|first[- ]?time\s*sign\s*up/i.test(String(msg))
      if (nameRequired) {
        setPendingVerify({ phone: phoneNumber, otp: otpDigits, fcmToken, platform })
        setShowNameModal(true)
        return
      }
      if (status === 401) {
        if (/deactivat(ed|e)/i.test(String(msg))) {
          msg = "Your account is deactivated. Please contact support."
        } else {
          msg = "Invalid or expired code, or account not active."
        }
      }
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleNameSubmit = async (e) => {
    e.preventDefault()
    if (!newName.trim()) {
      toast.error("Please enter your name")
      return
    }

    try {
      setIsUpdatingName(true)
      if (pendingVerify) {
        const response = await authAPI.verifyOTP(
          pendingVerify.phone,
          pendingVerify.otp,
          "login",
          newName.trim(),
          null,
          "user",
          null,
          null,
          pendingVerify.fcmToken,
          pendingVerify.platform,
        )
        const data = response?.data?.data || response?.data || {}
        const accessToken = data.accessToken
        const refreshToken = data.refreshToken || null
        const user = data.user

        setAuthData("user", accessToken, user, refreshToken)
        setPendingVerify(null)
        toast.success(`Welcome, ${newName.trim()}!`)
        setShowNameModal(false)
        navigate("/food/user", { replace: true })
        return
      }

      await userAPI.updateProfile({ name: newName.trim() })
      const updatedUser = { ...tempAuth.user, name: newName.trim() }
      setAuthData("user", tempAuth.accessToken, updatedUser, tempAuth.refreshToken)

      toast.success(`Welcome, ${newName.trim()}!`)
      setShowNameModal(false)
      navigate("/food/user", { replace: true })
    } catch (err) {
      toast.error("Failed to update name. You can skip this for now or try again.")
      console.error(err)
    } finally {
      setIsUpdatingName(false)
    }
  }

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return
    const intervalId = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [step, resendTimer])

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
    <div className="min-h-screen bg-[#FBF9F5] flex justify-center items-center relative overflow-x-hidden selection:bg-red-500 selection:text-white font-sans">
      {/* Mobile Card Container on Desktop / Full Screen on Mobile */}
      <div className="w-full max-w-[430px] min-h-screen sm:min-h-[920px] bg-[#FAF7F2] sm:shadow-[0_20px_60px_rgba(0,0,0,0.06)] relative flex flex-col justify-between overflow-hidden">
        
        {/* --- Background Delicate Doodles --- */}
        {/* Top-Left Pizza Doodle */}
        <div className="absolute top-8 left-8 pointer-events-none opacity-25">
          <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="#2D3748" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 22h20L12 2z" />
            <circle cx="12" cy="14" r="1.5" />
            <circle cx="9" cy="18" r="1" />
            <circle cx="15" cy="18" r="1" />
          </svg>
        </div>

        {/* Top-Right Burger Doodle */}
        <div className="absolute top-16 right-7 pointer-events-none opacity-20">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#2D3748" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11h16a1 1 0 0 0 1-1A6 6 0 0 0 3 10a1 1 0 0 0 1 1z" />
            <path d="M3 14h18" />
            <path d="M4 17h16a2 2 0 0 1 2 2 1 1 0 0 1-1 1H3a1 1 0 0 1-1-1 2 2 0 0 1 2-2z" />
          </svg>
        </div>

        {/* Mid-Left Burger Doodle */}
        <div className="absolute top-[380px] left-4 pointer-events-none opacity-20">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#2D3748" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11h16a1 1 0 0 0 1-1A6 6 0 0 0 3 10a1 1 0 0 0 1 1z" />
            <path d="M3 14h18" />
            <path d="M4 17h16a2 2 0 0 1 2 2 1 1 0 0 1-1 1H3a1 1 0 0 1-1-1 2 2 0 0 1 2-2z" />
          </svg>
        </div>

        {/* Mid-Right Fork & Knife Doodle */}
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
        
        {/* Tiny Red & Green Droplets */}
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
          
          {/* Circular CityFood Badge Logo (Rounded-full with border & shadow to clip white background) */}
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
            {step === 1 ? (
              <>
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
              </>
            ) : (
              <>
                <h1 className="text-[30px] sm:text-[34px] font-extrabold tracking-tight text-[#0A4D27]">
                  Verify OTP
                </h1>
                <div className="flex items-center justify-center gap-2 mt-1.5 text-[#6B7280] font-medium text-[15px]">
                  <span>Code sent to <strong>+91 {phoneNumber}</strong></span>
                  <button
                    onClick={handleEditNumber}
                    className="p-1 hover:bg-gray-200/60 rounded-full text-[#E52E2E] transition-colors"
                    title="Change phone number"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </motion.div>

          {/* Form Section */}
          <div className="w-full max-w-[360px]">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.form
                  key="step-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleSendOTP}
                  className="w-full flex flex-col items-center"
                >
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
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        autoFocus
                        value={phoneNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 10)
                          setPhoneNumber(val)
                          sessionStorage.setItem("draft_phone_login", val)
                        }}
                        maxLength={10}
                        placeholder="9755633314"
                        className="w-full bg-transparent border-none outline-none text-[#111827] font-semibold text-[16px] tracking-wider placeholder:text-gray-400 placeholder:font-normal p-0"
                      />
                    </div>
                  </div>

                  {/* Send OTP Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[56px] rounded-full bg-[#E52E2E] hover:bg-[#D92323] text-white font-bold text-[17px] shadow-[0_12px_28px_rgba(229,46,46,0.36)] hover:shadow-[0_16px_34px_rgba(229,46,46,0.46)] hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
                  >
                    {loading ? (
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
                </motion.form>
              ) : (
                <motion.form
                  key="step-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleVerifyOTP}
                  className="w-full flex flex-col items-center"
                >
                  {/* 6 Digit OTP Inputs */}
                  <div className="flex justify-between gap-2.5 w-full mb-4">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="tel"
                        inputMode="numeric"
                        maxLength={1}
                        required
                        autoFocus={index === 0}
                        value={otp[index] || ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(-1)
                          const newOtp = otp.split("")
                          newOtp[index] = val || ""
                          const combined = newOtp.join("").slice(0, 6)
                          setOtp(combined)
                          if (index < 5 && val) {
                            document.getElementById(`otp-${index + 1}`)?.focus()
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace") {
                            if (!otp[index] && index > 0) {
                              document.getElementById(`otp-${index - 1}`)?.focus()
                            } else {
                              const newOtp = otp.split("")
                              newOtp[index] = ""
                              setOtp(newOtp.join(""))
                            }
                          }
                        }}
                        className="w-12 h-14 text-center text-2xl font-bold bg-white border border-gray-200 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] text-[#111827] focus:border-[#E52E2E] focus:ring-2 focus:ring-[#E52E2E]/20 outline-none transition-all"
                      />
                    ))}
                  </div>

                  {/* Resend Timer & Button */}
                  <div className="flex items-center justify-between w-full text-xs text-gray-500 font-medium px-1 mb-2">
                    {resendTimer > 0 ? (
                      <span>Resend code in <strong className="text-gray-800">{resendTimer}s</strong></span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={loading}
                        className="text-[#E52E2E] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Resend OTP
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleEditNumber}
                      className="text-gray-600 hover:text-gray-900 font-medium cursor-pointer"
                    >
                      Change Number
                    </button>
                  </div>

                  {/* Verify OTP Button */}
                  <button
                    type="submit"
                    disabled={loading || otp.replace(/\D/g, "").length !== 6}
                    className="w-full h-[56px] rounded-full bg-[#E52E2E] hover:bg-[#D92323] text-white font-bold text-[17px] shadow-[0_12px_28px_rgba(229,46,46,0.36)] hover:shadow-[0_16px_34px_rgba(229,46,46,0.46)] hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-3 cursor-pointer disabled:opacity-60"
                  >
                    {loading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    ) : (
                      <>
                        <span>Verify & Login</span>
                        <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                      </>
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
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

        {/* --- New User Name Registration Modal --- */}
        <Dialog open={showNameModal} onOpenChange={setShowNameModal}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 shadow-2xl border-0">
            <DialogTitle className="text-xl font-extrabold text-[#0A4D27] text-center">
              Welcome to CityFood! 🎉
            </DialogTitle>
            <DialogDescription className="text-center text-gray-600 text-sm mt-1">
              What should we call you? Please enter your name to complete your profile.
            </DialogDescription>
            <form onSubmit={handleNameSubmit} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="user-name" className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Full Name
                </Label>
                <Input
                  id="user-name"
                  placeholder="e.g. John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-12 rounded-xl bg-gray-50 border-gray-200 text-gray-900 font-semibold focus:border-[#E52E2E] focus:ring-1 focus:ring-[#E52E2E]"
                  autoFocus
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={isUpdatingName || !newName.trim()}
                className="w-full h-12 rounded-xl bg-[#E52E2E] hover:bg-[#D92323] text-white font-bold text-base shadow-lg shadow-red-500/30 hover:brightness-105"
              >
                {isUpdatingName ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Continue to CityFood"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link, useNavigate } from "react-router-dom"
import { Phone, ArrowRight, ShieldCheck, Loader2, Utensils, Star, Heart, ShieldQuestion, ChefHat, Smartphone, MapPin, Gauge, Pizza, Leaf, Info, User } from "lucide-react"
import { toast } from "sonner"
import { authAPI, userAPI } from "@food/api"
import { setAuthData } from "@food/utils/auth"
import logoNew from "@/assets/logo.png"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"

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
    e.preventDefault()
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
    e.preventDefault()
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
            platform = "mobile";
            const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"];
            for (const handlerName of handlerNames) {
              try {
                const t = await window.flutter_inappwebview.callHandler(handlerName, { module: "user" });
                if (t && typeof t === "string" && t.length > 20) {
                  fcmToken = t.trim();
                  break;
                }
              } catch (e) { }
            }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null;
          }
        }
      } catch (e) {
        console.warn("Failed to get FCM token during login", e);
      }

      const response = await authAPI.verifyOTP(phoneNumber, otpDigits, "login", null, null, "user", null, null, fcmToken, platform)
      const data = response?.data?.data || response?.data || {}
      // Handle 2-step signup flow where name is required
      const needsName = data.needsName === true || data.isNewUser === true || (data.user && (!data.user.name || String(data.user.name).trim().length === 0 || String(data.user.name).toLowerCase() === "null"));

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

      // Call update profile API
      await userAPI.updateProfile({ name: newName.trim() })

      // Update local storage and auth data with the new name
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

  // iOS Safari keyboard float fix
  useEffect(() => {
    if (step === 2) {
      const handleFocus = () => {
        if (typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
          setTimeout(() => {
            window.scrollTo(0, 0);
          }, 50);
        }
      };
      const inputs = document.querySelectorAll('input[type="tel"]');
      inputs.forEach(input => input.addEventListener('focus', handleFocus));
      return () => {
        inputs.forEach(input => input.removeEventListener('focus', handleFocus));
      };
    }
  }, [step]);

  const formatResendTimer = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const primaryColor = "#E53935"

  // Floating animation variants
  const floatingAnimation = (delay, duration = 4, yOffset = 15) => ({
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
    <div className="min-h-[100dvh] bg-[#F7F7F7] dark:bg-[#0A0A0A] flex flex-col relative overflow-hidden font-['Poppins']">
      {/* iOS Keyboard Push-up Fix */}
      <style>{`
        @supports (-webkit-touch-callout: none) {
          body, html {
            height: -webkit-fill-available;
            overscroll-behavior-y: none;
          }
          .min-h-\\[100dvh\\] {
            min-height: -webkit-fill-available !important;
          }
          /* Prevent iOS from scrolling the fixed wrapper when input is focused */
          input:focus {
            scroll-margin-bottom: 50vh;
          }
        }
      `}</style>
      
      {/* Decorative Background Elements */}
      <div className="absolute top-[-15%] left-[-10%] w-[120%] h-[350px] bg-[#F76208]/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Content */}
      <div className="absolute top-4 right-4 z-20">
        <Link to="/user/auth/support" className="bg-[#FFFFFF]/80 dark:bg-[#141414]/80 backdrop-blur-md px-3.5 py-1.5 rounded-[12px] shadow-sm text-[#111111] dark:text-[#F5F5F5] hover:text-[#F76208] border border-[#E5E5E5] dark:border-[#2A2A2A] transition-all flex items-center gap-1.5 font-semibold text-[12px] uppercase tracking-wider">
          <Info className="w-4 h-4 text-[#F76208]" />
          <span>Support</span>
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start pt-[12vh] sm:pt-[15vh] px-6 pb-12 relative z-10 w-full max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full flex flex-col items-center"
        >
          {/* Central Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
            className="w-28 h-28 md:w-32 md:h-32 rounded-full shadow-[0_8px_30px_rgba(247,98,8,0.2)] border-4 border-white dark:border-[#141414] mb-8 overflow-hidden bg-white"
          >
            <img
              src={logoNew}
              alt="CityFood Logo"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/logo192.png'; // Fallback local logo
              }}
            />
          </motion.div>

          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center w-full mb-8"
          >
            <h1 className="text-[28px] sm:text-[32px] font-bold text-[#111111] dark:text-[#F5F5F5] leading-[1.2] mb-2 drop-shadow-sm">
              {step === 1 ? (
                <>Delicious food<br />Delivered fast <span className="inline-block hover:scale-110 transition-transform cursor-pointer">🍕</span></>
              ) : (
                "Verify OTP"
              )}
            </h1>
            <p className="text-[#666666] dark:text-[#A3A3A3] font-medium text-[14px]">
              {step === 1
                ? "Login with your mobile number"
                : `We've sent a code to +91 ${phoneNumber}`}
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form
                key="step-1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleSendOTP}
                className="w-full space-y-6"
              >
                <div className="relative flex items-center bg-[#FFFFFF]/90 dark:bg-[#141414]/90 backdrop-blur-md rounded-[14px] p-2 pl-4 pr-2 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)] border border-[#E5E5E5] dark:border-[#2A2A2A] transition-all hover:border-[#F76208]/30">
                  {/* Country Code & Icon */}
                  <div className="flex items-center gap-2 pr-3 border-r border-[#E5E5E5] dark:border-[#2A2A2A]">
                    <span className="text-[18px] leading-none">🇮🇳</span>
                    <span className="font-semibold text-[#111111] dark:text-[#F5F5F5]">+91</span>
                  </div>

                  {/* Phone Input */}
                  <div className="flex-1 flex items-center pl-3">
                    <Smartphone className="w-5 h-5 text-[#8A8A8A] mr-2 shrink-0" />
                    <input
                      type="tel"
                      required
                      autoFocus
                      value={phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setPhoneNumber(val);
                        sessionStorage.setItem("draft_phone_login", val);
                      }}
                      maxLength={10}
                      className="w-full bg-transparent border-0 outline-none focus:border-transparent focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 text-gray-800 dark:text-white font-semibold text-base placeholder:text-gray-400 placeholder:font-medium"
                      style={{ boxShadow: "none", border: "none", outline: "none" }}
                      placeholder="Enter your 10-digit number"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || phoneNumber.length < 10}
                  className="w-full h-[56px] rounded-full bg-gradient-to-r from-[#FF5252] to-[#E53935] text-white font-bold text-lg shadow-[0_10px_25px_rgba(229,57,53,0.4)] hover:shadow-[0_15px_35px_rgba(229,57,53,0.5)] hover:-translate-y-0.5 transition-all active:scale-[0.98] flex items-center justify-center disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-[0_10px_25px_rgba(229,57,53,0.4)]"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    "Send OTP"
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyOTP}
                className="space-y-6"
              >
                <div className="flex justify-between gap-3">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="tel"
                      inputMode="numeric"
                      required
                      autoFocus={index === 0}
                      value={otp[index] || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(-1);
                        if (!val) return;
                        const newOtp = otp.split("");
                        newOtp[index] = val;
                        const combined = newOtp.join("").slice(0, 6);
                        setOtp(combined);
                        if (index < 5 && val) {
                          document.getElementById(`otp-${index + 1}`)?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace") {
                          if (!otp[index] && index > 0) {
                            document.getElementById(`otp-${index - 1}`)?.focus();
                          } else {
                            const newOtp = otp.split("");
                            newOtp[index] = "";
                            setOtp(newOtp.join(""));
                          }
                        }
                      }}
                      className="w-full h-16 text-center text-3xl font-bold bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-primary/50 rounded-2xl outline-none transition-all text-red-600 dark:text-red-500 shadow-sm"
                      placeholder="•"
                    />
                  ))}
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {resendTimer > 0 ? (
                      <span className="text-gray-400">Resend code in <span className="text-primary">{formatResendTimer(resendTimer)}</span></span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        className="text-primary hover:underline"
                      >
                        Didn't receive code? Resend
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleEditNumber}
                    className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
                  >
                    Edit phone number
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full h-[50px] rounded-[14px] bg-[#F76208] hover:bg-[#E55A06] text-white font-semibold text-[16px] shadow-[0_4px_14px_rgba(247,98,8,0.3)] transition-all hover:translate-y-[-1px] active:scale-[0.98] flex items-center justify-center disabled:opacity-50 disabled:bg-[#E5E5E5] dark:disabled:bg-[#2A2A2A] disabled:text-[#8A8A8A] disabled:shadow-none disabled:hover:translate-y-0"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Continue"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Footer Info */}
          <div className="mt-8 text-center">
            <p className="text-[12px] text-[#666666] dark:text-[#A3A3A3] font-medium">
              By continuing, you agree to our <Link to="/profile/terms" className="text-[#111111] dark:text-[#F5F5F5] underline decoration-[#E5E5E5] dark:decoration-[#2A2A2A] underline-offset-2 hover:text-[#F76208] dark:hover:text-[#F76208] transition-colors">Terms</Link> & <Link to="/profile/privacy" className="text-[#111111] dark:text-[#F5F5F5] underline decoration-[#E5E5E5] dark:decoration-[#2A2A2A] underline-offset-2 hover:text-[#F76208] dark:hover:text-[#F76208] transition-colors">Privacy Policy</Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Name Collection Modal */}
      <style>{`
        [data-slot="dialog-overlay"] {
          background-color: rgba(17, 17, 17, 0.35) !important;
          backdrop-filter: blur(6px) !important;
          -webkit-backdrop-filter: blur(6px) !important;
        }
        .dark [data-slot="dialog-overlay"],
        html[class*="dark"] [data-slot="dialog-overlay"] {
          background-color: rgba(0, 0, 0, 0.62) !important;
        }
      `}</style>
      <Dialog open={showNameModal} onOpenChange={setShowNameModal}>
        <DialogContent
          className="w-[calc(100%-32px)] max-w-[360px] h-auto rounded-[24px] border border-[#E5E5E5] dark:border-[#2A2A2A] p-[20px] bg-[#FFFFFF] dark:bg-[#141414] shadow-2xl !top-[60%] sm:!top-1/2"
          showCloseButton={!pendingVerify}
        >
          <div className="flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-[48px] h-[48px] bg-gray-100 dark:bg-[#1A1A1A] rounded-full flex items-center justify-center mb-[12px] border border-gray-200 dark:border-[#2A2A2A]"
            >
              <User className="w-[22px] h-[22px] text-[#111111] dark:text-[#F5F5F5]" />
            </motion.div>
            <DialogTitle className="text-[20px] font-bold text-[#111111] dark:text-[#F5F5F5] mb-[6px] tracking-tight">
              Almost there!
            </DialogTitle>
            <DialogDescription className="text-[#666666] dark:text-[#A3A3A3] text-[13.5px] max-w-[260px] mx-auto leading-[1.4]">
              Tell us your name to personalize your experience.
            </DialogDescription>
          </div>

          <form onSubmit={handleNameSubmit} className="mt-[20px]">
            <div className="space-y-[6px]">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-[16px] flex items-center pointer-events-none">
                  <User className="w-[18px] h-[18px] text-[#8A8A8A]" />
                </div>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full name"
                  className="pl-[42px] h-[50px] bg-[#F8F8F8] dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-[14px] text-[#111111] dark:text-[#F5F5F5] placeholder:text-[#8A8A8A] focus:ring-1 focus:ring-[#F76208]/60 focus:border-[#F76208] transition-all text-[15px] outline-none shadow-none"
                  autoFocus
                />
              </div>
              {pendingVerify && newName.trim().length === 0 && (
                <p className="text-[13px] text-[#FF5C5C] pl-1 font-medium text-left">Name is required to complete signup.</p>
              )}
            </div>

            <div className="flex flex-col gap-[12px] mt-[16px]">
              <Button
                type="submit"
                disabled={isUpdatingName || (pendingVerify && !newName.trim())}
                className="w-full h-[50px] bg-[#F76208] hover:bg-[#F76208]/90 text-white rounded-[14px] font-semibold text-[16px] shadow-[0_4px_12px_rgba(247,98,8,0.25)] transition-all hover:scale-[1.01] active:scale-[0.96] disabled:opacity-85 disabled:bg-[rgba(247,98,8,0.45)] disabled:text-white disabled:shadow-none disabled:hover:scale-100 disabled:active:scale-100"
              >
                {isUpdatingName ? (
                  <Loader2 className="h-[20px] w-[20px] animate-spin" />
                ) : (
                  "Complete Profile"
                )}
              </Button>
              {!pendingVerify && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNameModal(false)
                    navigate("/food/user", { replace: true })
                  }}
                  className="text-[13px] text-[#8A8A8A] hover:text-[#111111] dark:hover:text-[#F5F5F5] transition-colors py-1"
                >
                  Skip for now
                </button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

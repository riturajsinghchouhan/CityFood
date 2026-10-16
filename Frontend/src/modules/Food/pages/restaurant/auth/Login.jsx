import { useEffect, useRef, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  Headphones,
  ShieldCheck,
  Heart,
  ArrowRight,
  Loader2,
  ChefHat,
  CheckCircle2,
  X,
  Phone,
  MessageCircle,
  HelpCircle,
  Sparkles
} from "lucide-react"
import { Button } from "@food/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { toast } from "sonner"
import { restaurantAPI } from "@food/api"
import { useAppLogo } from "@food/hooks/useAppLogo"
import { useCompanyName } from "@food/hooks/useCompanyName"
import logoNew from "@/assets/logo.png"

const DEFAULT_COUNTRY_CODE = "+91"
const DEMO_PHONE = "9876543210"

// Botanical Leaf Component (Matching realistic green basil leaves in reference image)
const BotanicalLeaf = ({ className = "w-8 h-8", rotate = 0, opacity = 0.9 }) => (
  <svg
    viewBox="0 0 64 64"
    className={className}
    style={{ transform: `rotate(${rotate}deg)`, opacity }}
  >
    <defs>
      <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4ADE80" />
        <stop offset="45%" stopColor="#22C55E" />
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

export default function RestaurantLogin() {
  const logoUrl = useAppLogo("restaurant_app") || "/logo.png" || logoNew
  const companyName = useCompanyName() || "CityFood"
  const navigate = useNavigate()
  const phoneInputRef = useRef(null)

  const [phone, setPhone] = useState(() => sessionStorage.getItem("restaurantLoginPhone") || "")
  const [loading, setLoading] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
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
    if (digits.length !== 10) return false
    return ["6", "7", "8", "9"].includes(digits[0])
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
      await restaurantAPI.sendOTP(fullPhone, "login")
      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "restaurant",
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))
      sessionStorage.setItem("restaurantLoginPhone", phone)
      toast.success("Verification code sent!")
      navigate("/food/restaurant/otp")
    } catch (apiErr) {
      const msg = apiErr?.response?.data?.message || apiErr?.message || "Failed to send OTP."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  return (
    <div className="min-h-screen bg-[#FFF9F4] text-[#1e293b] flex justify-center items-center relative overflow-x-hidden font-['Poppins'] select-none">
      {/* iOS Keyboard Push-up Fix */}
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
      `}</style>

      {/* Main Container constrained to mobile app layout on desktop */}
      <div className="w-full max-w-[430px] min-h-screen bg-gradient-to-b from-[#FFFDF9] via-[#FFF9F4] to-[#FFF3EC] sm:shadow-[0_20px_60px_rgba(0,0,0,0.08)] relative flex flex-col justify-between pb-6 overflow-hidden">
        
        {/* --- Top Section: Culinary Photographic Banner & Organic Crimson Wave --- */}
        <div className="relative w-full h-[250px] sm:h-[270px] overflow-hidden">
          {/* Header Image */}
          <img
            src="/restaurant-banner.jpg"
            alt="Culinary Kitchen Banner"
            className="w-full h-full object-cover object-center filter brightness-[0.92] contrast-105"
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = "/restaurant-banner.jpg"
            }}
          />

          {/* Dark Red & Crimson Gradient Overlays matching reference image */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#7a0018]/90 via-[#990022]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />

          {/* Sliced Tomato graphic accent on top-left */}
          <div className="absolute top-3 left-3 w-16 h-16 rounded-full bg-radial from-[#FF3B30] to-[#B00A25] shadow-lg border-2 border-[#FF6B6B]/40 flex items-center justify-center pointer-events-none opacity-90 overflow-hidden">
            <div className="w-12 h-12 rounded-full border border-yellow-200/40 relative flex items-center justify-center">
              <div className="absolute w-2 h-2 rounded-full bg-yellow-100/60" />
              <div className="absolute top-1 left-3 w-1.5 h-1.5 rounded-full bg-yellow-200/80" />
              <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-yellow-200/80" />
              <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-yellow-200/80" />
            </div>
          </div>

          {/* Organic Floating Green Leaf near Tomato */}
          <div className="absolute top-3 left-20 pointer-events-none">
            <BotanicalLeaf className="w-9 h-9" rotate={-25} opacity={0.95} />
          </div>

          {/* Red Outline Chef Hat Icon over chef hat on right */}
          <div className="absolute top-16 right-9 pointer-events-none drop-shadow-md">
            <ChefHat className="w-10 h-10 text-[#FF4D6D] stroke-[2.2]" />
          </div>

          {/* Top Right "Support" Button with Headphones */}
          <button
            type="button"
            onClick={() => setShowSupportModal(true)}
            className="absolute top-5 right-5 z-20 flex items-center gap-1.5 text-white/95 hover:text-white font-bold text-sm drop-shadow-md px-3 py-1.5 rounded-full bg-black/20 hover:bg-black/30 backdrop-blur-sm transition-all focus:outline-none"
          >
            <Headphones className="w-4 h-4 stroke-[2.4]" />
            <span>Support</span>
          </button>

          {/* Curved Organic Separator Wave at bottom */}
          <div className="absolute -bottom-1 left-0 right-0 pointer-events-none">
            <svg
              viewBox="0 0 500 120"
              preserveAspectRatio="none"
              className="w-full h-16 sm:h-20"
            >
              <path
                d="M0,0 C150,110 350,110 500,0 L500,120 L0,120 Z"
                fill="#FFFDF9"
              />
            </svg>
          </div>
        </div>

        {/* --- Center Overlapping Logo Badge & "RESTAURANT PARTNER" Pill --- */}
        <div className="relative z-20 flex flex-col items-center -mt-16 sm:-mt-20">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
            className="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)] border-4 border-white overflow-hidden p-1.5 flex items-center justify-center relative group"
          >
            <img
              src={logoUrl}
              alt="Restaurant Partner Logo"
              className="w-full h-full object-contain filter drop-shadow select-none pointer-events-none group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.src = "/logo.png"
              }}
            />
          </motion.div>

          {/* "RESTAURANT PARTNER" Title & Red Line */}
          <div className="text-center mt-3">
            <p className="text-[12px] sm:text-[13px] font-black uppercase tracking-[0.26em] text-[#4b5563]">
              RESTAURANT PARTNER
            </p>
            <div className="w-12 h-1 bg-[#D3122A] rounded-full mx-auto mt-1.5" />
          </div>
        </div>

        {/* --- Floating Realistic Green Leaves in Background --- */}
        <div className="absolute top-[320px] -left-2 pointer-events-none z-10">
          <BotanicalLeaf className="w-11 h-11" rotate={-35} opacity={0.9} />
        </div>
        <div className="absolute top-[340px] -right-2 pointer-events-none z-10">
          <BotanicalLeaf className="w-10 h-10" rotate={30} opacity={0.85} />
        </div>

        {/* --- Main Login Card (White Pill Container matching Image) --- */}
        <div className="relative z-20 px-5 sm:px-6 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full bg-white/95 backdrop-blur-md rounded-[2.5rem] sm:rounded-[44px] shadow-[0_15px_45px_rgba(0,0,0,0.06)] border border-white p-6 sm:p-8"
          >
            {/* Card Title */}
            <div className="text-center mb-6">
              <h1 className="text-3xl sm:text-[34px] font-black text-[#111827] tracking-tight font-['Outfit']">
                Partner <span className="text-[#D3122A]">Login</span>
              </h1>
              <p className="text-[14px] sm:text-[15px] text-[#64748b] font-medium leading-relaxed max-w-[270px] mx-auto mt-2">
                Enter your registered mobile number to manage your restaurant
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[11px] font-black uppercase tracking-[0.18em] text-[#D3122A]">
                    Mobile Number
                  </label>
                  {/* Quick Demo Fill Helper */}
                  <button
                    type="button"
                    onClick={() => {
                      setPhone(DEMO_PHONE)
                      toast.info("Demo phone filled: +91 9876543210 (Use OTP 1234)", {
                        duration: 3500,
                      })
                      if (phoneInputRef.current) phoneInputRef.current.focus()
                    }}
                    className="text-[10px] font-bold text-gray-400 hover:text-[#D3122A] transition-colors focus:outline-none flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-[#D3122A]" />
                    <span>Demo</span>
                  </button>
                </div>

                {/* Input Box */}
                <div className="w-full bg-white rounded-2xl border border-gray-200/90 shadow-2xs px-4 py-3.5 flex items-center transition-all focus-within:border-[#D3122A]/70 focus-within:ring-2 focus-within:ring-[#D3122A]/10">
                  {/* Flag & Prefix */}
                  <div className="flex items-center gap-2 shrink-0 select-none">
                    <img
                      src="https://flagcdn.com/w40/in.png"
                      alt="India Flag"
                      className="w-5 h-auto rounded-[2px] shadow-xs object-cover"
                    />
                    <span className="text-base font-bold text-[#1f2937] tracking-tight">
                      +91
                    </span>
                  </div>

                  {/* Vertical Subtle Divider */}
                  <div className="h-6 w-px bg-gray-200 mx-3 shrink-0" />

                  {/* Mobile Input Field */}
                  <input
                    ref={phoneInputRef}
                    type="tel"
                    required
                    autoFocus
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 10)
                      setPhone(val)
                      sessionStorage.setItem("restaurantLoginPhone", val)
                    }}
                    maxLength={10}
                    placeholder="00000 00000"
                    className="flex-1 bg-transparent border-none outline-none text-[#111827] font-bold text-base sm:text-lg tracking-wider placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-widest min-w-0"
                  />

                  {/* Status Indicator / Clear */}
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
              </div>

              {/* Red CTA Pill Button ("Get Start ->" matching reference image) */}
              <button
                type="submit"
                disabled={loading || !isValidNumber}
                className="w-full py-4 rounded-full font-bold text-white text-[17px] tracking-wide bg-gradient-to-r from-[#C80F2E] via-[#D3122A] to-[#B00A25] hover:brightness-105 active:scale-[0.98] shadow-[0_12px_28px_rgba(211,18,42,0.36)] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2 mt-5 cursor-pointer"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Verifying...</span>
                  </div>
                ) : (
                  <>
                    <span>Get Start</span>
                    <ArrowRight className="w-5 h-5 stroke-[2.8]" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>

        {/* --- Footer Terms & Legal --- */}
        <div className="relative z-20 text-center px-4 mt-6">
          <p className="text-[12px] sm:text-[13px] text-gray-500 font-medium leading-relaxed">
            By continuing, you agree to {companyName}'s <br />
            <Link
              to="/food/restaurant/profile/terms"
              className="text-[#D3122A] font-bold underline hover:text-[#B00A25] mx-1"
            >
              Terms of Service
            </Link>
            &
            <Link
              to="/food/restaurant/profile/privacy"
              className="text-[#D3122A] font-bold underline hover:text-[#B00A25] ml-1"
            >
              Privacy Policy
            </Link>
          </p>
        </div>

        {/* --- Trust Badges: BUSINESS VERIFIED & PARTNER SUCCESS --- */}
        <div className="relative z-20 flex items-center justify-center gap-5 sm:gap-6 mt-6 pb-2 text-gray-400 select-none">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-5 h-5 rounded-full border border-[#D3122A]/30 text-[#D3122A] flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-400">
              BUSINESS VERIFIED
            </span>
          </div>

          <div className="h-4 w-px bg-gray-300" />

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-5 h-5 rounded-full border border-[#D3122A]/30 text-[#D3122A] flex items-center justify-center">
              <Heart className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-400">
              PARTNER SUCCESS
            </span>
          </div>
        </div>

        {/* --- Bottom Ambient Soft Organic Wave Decor --- */}
        <div className="relative w-full h-8 overflow-hidden pointer-events-none opacity-40">
          <div className="absolute inset-0 bg-gradient-to-t from-[#FFE8DA] to-transparent" />
        </div>
      </div>

      {/* Built-in Help & Support Modal */}
      <Dialog open={showSupportModal} onOpenChange={setShowSupportModal}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-md bg-white text-[#1e293b] rounded-3xl p-0 overflow-hidden border border-gray-100 shadow-2xl">
          <DialogHeader className="px-5 py-4 border-b border-gray-100 pr-12">
            <DialogTitle className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
              <Headphones className="w-5 h-5 text-[#D3122A]" />
              <span>Restaurant Partner Support</span>
            </DialogTitle>
          </DialogHeader>

          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
            {/* Direct Helpline Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href="tel:18008894567"
                className="p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-colors flex items-center gap-2.5"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-xs">Partner Helpline</p>
                  <p className="text-[11px] text-gray-500">1800-889-4567</p>
                </div>
              </a>

              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-colors flex items-center gap-2.5"
              >
                <div className="w-8 h-8 rounded-xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shrink-0">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-xs">WhatsApp Help</p>
                  <p className="text-[11px] text-gray-500">Instant Chat</p>
                </div>
              </a>
            </div>

            {/* Quick Demo Credentials Info */}
            <div className="p-3 rounded-2xl bg-red-50/80 border border-red-100 space-y-1">
              <div className="flex items-center gap-1.5 text-[#D3122A] font-bold text-xs">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Testing & Demo Access</span>
              </div>
              <p className="text-gray-600 text-[11px] leading-relaxed">
                If you are testing the restaurant portal, use:
              </p>
              <div className="flex items-center gap-3 pt-1 font-mono text-[11px] text-gray-800">
                <span className="bg-white px-2 py-0.5 rounded border border-gray-200">Phone: 9876543210</span>
                <span className="bg-white px-2 py-0.5 rounded border border-gray-200">OTP: 1234 or 123456</span>
              </div>
            </div>

            {/* Frequently Asked Questions */}
            <div className="space-y-2 pt-1">
              <p className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">
                Common Questions
              </p>

              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                <p className="font-semibold text-gray-900 text-xs">Not receiving the verification SMS?</p>
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Wait up to 30 seconds or check cellular reception. You can request a resend OTP after countdown on the next screen.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                <p className="font-semibold text-gray-900 text-xs">Changed your registered phone number?</p>
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Call our Partner Helpline with your Restaurant Outlet ID or FSSAI registration number to update your phone number securely.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-gray-100 bg-gray-50/50">
            <Button
              type="button"
              onClick={() => setShowSupportModal(false)}
              className="w-full bg-[#111827] hover:bg-black text-white font-semibold h-9 rounded-xl text-xs transition-colors"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

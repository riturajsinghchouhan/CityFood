import React, { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRight,
  BadgeIndianRupee,
  Bike,
  Building2,
  CheckCircle2,
  Clock,
  Headphones,
  LineChart,
  Loader2,
  MapPin,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Utensils,
  Zap,
} from "lucide-react"
import api from "@food/api"

/**
 * Public "partner with us" pages: /franchise/landingpage, /res/landingpage, /deli/landingpage.
 * Hero, a showcase card, four benefit cards and the inquiry form (it lands in Admin > Manage Inquiry).
 */
const RED = "#E23744"

const PAGES = {
  franchise: {
    dark: false,
    badge: { icon: Building2, text: "City Franchise Program" },
    title: "Own Your City.",
    subtitle: "Build a Food Business That Grows With It.",
    intro: (
      <>
        Bring CityFood to your city. We hand you a proven food delivery platform, a trusted brand and{" "}
        <b className="font-semibold text-slate-900">complete launch support</b>, so you can focus on growing your local network.
      </>
    ),
    showcase: {
      tag: "Now Expanding: New Cities",
      title: "Run Your City on CityFood",
      text: "Onboard restaurants and delivery partners, set your own pricing and watch your city grow from one simple dashboard.",
    },
    widget: "franchise",
    cards: [
      { icon: MapPin, title: "Exclusive City Rights", text: "Operate CityFood in your own city and build a local business that belongs to you.", foot: "Your City, Your Business" },
      { icon: Sparkles, title: "Ready Tech Platform", text: "Customer app, restaurant app, rider app and a full admin panel, ready on day one.", foot: "Launch Without Building" },
      { icon: Megaphone, title: "Brand & Launch Support", text: "Marketing, training and on-ground help from our team while you set up and launch.", foot: "Never Alone" },
      { icon: LineChart, title: "Transparent Earnings", text: "See every order, payout and settlement clearly, and track your growth day by day.", foot: "Clear Numbers" },
    ],
    formTitle: "Become a Franchise Partner",
    formText: "Fill out the form below to register your interest, and our franchise team will contact you to discuss your city.",
    fields: "franchise",
  },
  restaurant: {
    dark: false,
    badge: { icon: Store, text: "Restaurant Growth Program" },
    title: "Grow Your Restaurant.",
    subtitle: "Reach More Hungry Customers.",
    intro: (
      <>
        List your restaurant on CityFood and start receiving online orders from customers near you, with{" "}
        <b className="font-semibold text-slate-900">easy menu control and timely payouts</b>.
      </>
    ),
    showcase: {
      tag: "Partner Onboarding Open",
      title: "Set Up Your Digital Kitchen",
      text: "Register your restaurant, add your menu and start accepting orders on your phone or tablet within days.",
    },
    widget: "restaurant",
    cards: [
      { icon: Users, title: "Reach New Customers", text: "Get discovered by food lovers in your area who order online every day.", foot: "More Orders" },
      { icon: Utensils, title: "Live Menu Control", text: "Switch items on or off, change prices and run offers whenever you want.", foot: "Zero Lag Updates" },
      { icon: BadgeIndianRupee, title: "Timely Payouts", text: "Your earnings are settled to your bank account on time, with a clear statement for every order.", foot: "Healthy Cash Flow" },
      { icon: Headphones, title: "Dedicated Support", text: "A partner team that helps you with onboarding, menu setup and anything you need later.", foot: "Always Reachable" },
    ],
    formTitle: "Become a Restaurant Partner",
    formText: "Fill out the form below to register your interest, and our onboarding team will contact you to set up your restaurant on CityFood.",
    fields: "restaurant",
  },
  delivery: {
    dark: true,
    badge: { icon: Bike, text: "Delivery Partner Program" },
    title: "Ride on Your Terms.",
    subtitle: "Earn More, Every Single Day.",
    intro: (
      <>
        Join the CityFood delivery crew. Choose your own hours, earn for every delivery and get{" "}
        <b className="font-semibold text-white">regular payouts</b> straight to your account.
      </>
    ),
    showcase: {
      tag: "Riders Wanted in Your City",
      title: "Join the Active Delivery Crew",
      text: "Quick onboarding: share your details, upload your documents and start accepting delivery requests.",
    },
    widget: "delivery",
    cards: [
      { icon: Clock, title: "Flexible Timing", text: "Go online when you want and take a break when you need. No fixed shifts.", foot: "Your Schedule" },
      { icon: BadgeIndianRupee, title: "Earn Per Delivery", text: "Clear distance-based earnings for every order you deliver, visible in your app.", foot: "Honest Earnings" },
      { icon: TrendingUp, title: "Regular Payouts", text: "Withdraw your earnings to your bank account easily from the rider app.", foot: "Steady Cash Flow" },
      { icon: ShieldCheck, title: "Rider Support", text: "Help over chat and phone whenever you are on the road.", foot: "Supported Every Mile" },
    ],
    formTitle: "Start Earning with CityFood",
    formText: "Fill out the form below and our team will call you to complete your onboarding.",
    fields: "delivery",
  },
}

const VEHICLES = [
  { value: "bike", label: "Bike" },
  { value: "scooter", label: "Scooter" },
  { value: "electric", label: "Electric Vehicle" },
  { value: "bicycle", label: "Bicycle" },
]

const EMPTY = { fullName: "", phone: "", city: "", restaurantName: "", vehicleType: "" }

/* ---------- Showcase widgets ---------- */

function FranchiseWidget() {
  const stats = [
    { label: "Orders today", value: "1,248" },
    { label: "Restaurants live", value: "86" },
    { label: "Riders online", value: "142" },
    { label: "Avg. delivery", value: "24 min" },
  ]
  return (
    <div className="w-full max-w-sm rounded-[24px] border border-white/10 bg-[#0B1220] p-5 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white">
          <Building2 className="h-4 w-4" style={{ color: RED }} /> City Control Room
        </span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: `${RED}26`, color: RED }}>Live</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
            <p className="mt-1 text-xl font-extrabold text-white">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <span>Monthly target</span>
          <span className="text-white">78%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[78%] rounded-full" style={{ background: `linear-gradient(90deg, ${RED}, #FF8A5B)` }} />
        </div>
      </div>
    </div>
  )
}

function RestaurantWidget() {
  return (
    <div className="w-full max-w-sm rounded-[24px] border-[3px] border-slate-700/70 bg-[#0B1220] p-5 shadow-2xl">
      <div className="mx-auto -mt-3 mb-3 h-1.5 w-16 rounded-full bg-slate-700" />
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white">
          <Store className="h-4 w-4" style={{ color: RED }} /> Live Orders
        </span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: `${RED}26`, color: RED }}>Online</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Orders today</p>
          <p className="mt-1 text-xl font-extrabold" style={{ color: RED }}>64</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sales today</p>
          <p className="mt-1 text-xl font-extrabold text-white">₹18,450</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-white">New order #CF1042</p>
          <span className="text-[10px] text-slate-400">just now</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">2 × Paneer Tikka · 1 × Butter Naan</p>
      </div>
      <div className="mt-4 rounded-xl py-2.5 text-center text-[11px] font-extrabold uppercase tracking-wider text-white" style={{ background: RED }}>
        Accept Order
      </div>
    </div>
  )
}

function DeliveryWidget() {
  return (
    <div className="w-full max-w-[260px] rounded-[34px] border-[3px] border-slate-700/80 bg-[#05070D] p-4 shadow-2xl">
      <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-slate-700" />
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> On Duty
        </span>
        <span className="rounded-full border px-2 py-0.5 text-[9px] font-bold" style={{ borderColor: RED, color: RED }}>GPS Active</span>
      </div>
      <div className="mt-3 rounded-2xl border border-white/15 p-3">
        <div className="flex justify-between text-[9px] font-semibold uppercase tracking-wider text-slate-400">
          <span>Drop location</span>
          <span className="text-white">1.2 km away</span>
        </div>
        <svg viewBox="0 0 200 90" className="mt-2 h-24 w-full">
          <path d="M15 70 C 60 20, 110 85, 185 25" fill="none" stroke={RED} strokeWidth="3" strokeDasharray="6 6" strokeLinecap="round" />
          <circle cx="15" cy="70" r="6" fill="#6366F1" />
          <circle cx="185" cy="25" r="6" fill={RED} />
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>Earned today</span>
          <span className="font-bold text-white">₹1,240</span>
        </div>
      </div>
      <div className="mt-3 rounded-xl py-2.5 text-center text-[10px] font-extrabold uppercase tracking-wider text-white" style={{ background: `linear-gradient(90deg, ${RED}, #8B5CF6)` }}>
        Deliver Order
      </div>
    </div>
  )
}

const WIDGETS = { franchise: FranchiseWidget, restaurant: RestaurantWidget, delivery: DeliveryWidget }

/* ---------- Page ---------- */

function validate(form, kind) {
  if (form.fullName.trim().length < 2) return "Enter your full name"
  if (!/^[6-9]\d{9}$/.test(form.phone)) return "Enter a valid 10-digit mobile number"
  if (form.city.trim().length < 2) return "Enter your city"
  if (kind === "delivery" && !form.vehicleType) return "Select your vehicle type"
  if (kind === "franchise" && form.restaurantName.trim().length < 2) return "Enter the franchise name"
  if (kind === "restaurant" && form.restaurantName.trim().length < 2) return "Enter the restaurant name"
  return ""
}

export default function PartnerLandingPage({ type = "franchise" }) {
  const page = PAGES[type] || PAGES.franchise
  const navigate = useNavigate()
  const dark = page.dark
  const Widget = WIDGETS[page.widget]
  const BadgeIcon = page.badge.icon
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [type])

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: key === "phone" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value }))

  const scrollToForm = () => document.getElementById("partner-form")?.scrollIntoView({ behavior: "smooth", block: "start" })

  const submit = async (e) => {
    e.preventDefault()
    const error = validate(form, page.fields)
    if (error) {
      toast.error(error)
      return
    }
    setSubmitting(true)
    try {
      const body = { type, fullName: form.fullName, phone: form.phone, city: form.city }
      if (page.fields === "delivery") body.vehicleType = form.vehicleType
      else body.restaurantName = form.restaurantName
      await api.post("/food/inquiries", body)
      setSubmitted(true)
      setForm(EMPTY)
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not send your request. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // Theme
  const t = dark
    ? {
        page: "bg-[#07080B] text-slate-100",
        header: "border-white/10 bg-[#07080B]/85",
        logoText: "text-white",
        heading: "text-white",
        body: "text-slate-400",
        card: "border-white/10 bg-[#0B0E16]",
        cardTitle: "text-white",
        cardText: "text-slate-400",
        divider: "border-white/10",
        formCard: "border-white/10 bg-[#0B0E16]",
        label: "text-slate-300",
        input: "border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500",
        secondary: "bg-white/[0.06] text-white hover:bg-white/10",
        footer: "border-white/10 bg-[#040509] text-slate-400",
        glow: "radial-gradient(60% 50% at 50% 0%, rgba(226,55,68,0.18) 0%, rgba(7,8,11,0) 70%)",
      }
    : {
        page: "bg-[#FAF7F2] text-slate-900",
        header: "border-slate-200/70 bg-[#FAF7F2]/85",
        logoText: "text-slate-900",
        heading: "text-[#0F172A]",
        body: "text-slate-500",
        card: "border-slate-100 bg-white",
        cardTitle: "text-[#0F172A]",
        cardText: "text-slate-500",
        divider: "border-slate-100",
        formCard: "border-slate-100 bg-white",
        label: "text-slate-700",
        input: "border-slate-200 bg-slate-50/70 text-slate-900 placeholder:text-slate-400",
        secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200",
        footer: "border-slate-200 bg-slate-50 text-slate-500",
        glow: "radial-gradient(60% 50% at 50% 0%, rgba(226,55,68,0.10) 0%, rgba(250,247,242,0) 70%)",
      }

  const inputClass = `w-full rounded-2xl border px-5 py-3.5 text-sm outline-none transition focus:border-[#E23744] focus:ring-4 focus:ring-[#E23744]/15 ${t.input}`
  const fade = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.5 } }

  return (
    <div className={`min-h-screen overflow-x-hidden ${t.page}`} style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,200;1,300&family=Inter+Tight:wght@800;900&display=swap');
        .pl-display { font-family: 'Inter Tight', 'Inter', system-ui, sans-serif; letter-spacing: -0.035em; }
        .pl-thin { font-family: 'Inter', system-ui, sans-serif; font-weight: 200; font-style: italic; letter-spacing: -0.03em; }
      `}</style>

      {/* Header */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${t.header}`}>
        <div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-9 w-9 rounded-full object-contain" />
            <span className={`pl-display text-xl font-black ${t.logoText}`}>
              CityFood<span style={{ color: RED }}>.</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={scrollToForm}
              className="hidden items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95 sm:inline-flex"
              style={{ background: RED, boxShadow: `0 10px 24px -12px ${RED}` }}
            >
              <Sparkles className="h-4 w-4" /> Become a Partner
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold transition active:scale-95 ${
                dark ? "text-white" : "bg-[#0F172A] text-white hover:bg-black"
              }`}
              style={dark ? { background: RED } : undefined}
            >
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </button>
          </div>
        </div>
      </header>

      {/* 1. Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0" style={{ background: t.glow }} />
        <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-16 text-center sm:px-8 sm:pt-24">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] sm:text-xs"
            style={{ borderColor: `${RED}40`, background: `${RED}${dark ? "1A" : "12"}`, color: RED }}
          >
            <BadgeIcon className="h-4 w-4" /> {page.badge.text}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.55 }}
            className="mt-7"
          >
            <span className={`pl-display block text-[42px] font-black leading-[1.02] sm:text-6xl lg:text-[76px] ${t.heading}`}>{page.title}</span>
            <span
              className="pl-thin mt-2 block text-[34px] leading-[1.1] sm:text-5xl lg:text-[64px]"
              style={dark ? { background: `linear-gradient(90deg, ${RED}, #A78BFA)`, WebkitBackgroundClip: "text", color: "transparent" } : { color: RED }}
            >
              {page.subtitle}
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.55 }}
            className={`mx-auto mt-7 max-w-3xl text-base font-light leading-relaxed sm:text-xl ${t.body}`}
          >
            {page.intro}
          </motion.p>
        </div>
      </section>

      {/* 2. Showcase */}
      <section className="px-4 sm:px-8">
        <motion.div
          {...fade}
          className="relative mx-auto grid max-w-7xl items-center gap-10 overflow-hidden rounded-[32px] border border-white/5 px-6 py-10 sm:rounded-[40px] sm:px-14 sm:py-14 lg:grid-cols-[1.25fr_1fr]"
          style={{ background: dark ? "linear-gradient(135deg, #070B1A 0%, #0B1023 60%, #12081A 100%)" : "linear-gradient(135deg, #0F172A 0%, #111827 60%, #2A0E18 100%)" }}
        >
          <div>
            <span className="inline-flex rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] sm:text-[11px]" style={{ borderColor: `${RED}66`, background: `${RED}1A`, color: RED }}>
              {page.showcase.tag}
            </span>
            <h2 className="pl-display mt-5 text-3xl font-black text-white sm:text-[40px] sm:leading-tight">{page.showcase.title}</h2>
            <p className="mt-4 max-w-xl text-[15px] font-light leading-relaxed text-slate-300">{page.showcase.text}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={scrollToForm}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-slate-900 transition hover:bg-slate-100 active:scale-95"
              >
                Register Your Interest <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10 active:scale-95"
              >
                Explore CityFood
              </button>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <Widget />
          </div>
        </motion.div>
      </section>

      {/* 3. Benefit cards */}
      <section className="px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-6 sm:gap-10 md:grid-cols-2">
          {page.cards.map(({ icon: Icon, title, text, foot }, i) => (
            <motion.div
              key={title}
              {...fade}
              transition={{ duration: 0.5, delay: (i % 2) * 0.08 }}
              className={`rounded-[28px] border p-7 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.35)] transition hover:-translate-y-1 sm:rounded-[32px] sm:p-10 ${t.card}`}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border" style={{ borderColor: `${RED}26`, background: `${RED}${dark ? "1F" : "10"}`, color: RED }}>
                <Icon className="h-6 w-6" />
              </span>
              <h3 className={`pl-display mt-8 text-2xl font-black ${t.cardTitle}`}>{title}</h3>
              <p className={`mt-3 text-[15px] font-light leading-relaxed ${t.cardText}`}>{text}</p>
              <div className={`mt-8 flex items-center gap-2 border-t pt-6 text-xs font-bold uppercase tracking-[0.12em] text-slate-400 ${t.divider}`}>
                <Zap className="h-4 w-4" style={{ color: RED }} /> {foot}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 4. Form */}
      <section id="partner-form" className="scroll-mt-20 px-4 pb-24 sm:px-8">
        <div className={`mx-auto max-w-5xl border-t pt-16 sm:pt-20 ${t.divider}`}>
          <motion.div {...fade} className="text-center">
            <h2 className={`pl-display text-3xl font-black sm:text-[40px] ${t.heading}`}>{page.formTitle}</h2>
            <p className={`mx-auto mt-3 max-w-xl text-[15px] font-light leading-relaxed ${t.body}`}>{page.formText}</p>
          </motion.div>

          <motion.div {...fade} className={`mx-auto mt-10 max-w-3xl rounded-[28px] border p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] sm:rounded-[36px] sm:p-10 ${t.formCard}`}>
            {submitted ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="mx-auto h-16 w-16" style={{ color: RED }} />
                <h3 className={`pl-display mt-5 text-2xl font-black ${t.heading}`}>Request received!</h3>
                <p className={`mx-auto mt-2 max-w-sm text-sm ${t.body}`}>Thank you. Our team will call you on your mobile number soon.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <button type="button" onClick={() => setSubmitted(false)} className={`rounded-2xl px-6 py-3 text-sm font-bold transition ${t.secondary}`}>
                    Send another request
                  </button>
                  <button type="button" onClick={() => navigate("/")} className="rounded-2xl px-6 py-3 text-sm font-bold text-white" style={{ background: RED }}>
                    Return to Homepage
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className={`mb-2 block text-xs font-extrabold uppercase tracking-[0.08em] ${t.label}`}>Full Name</span>
                    <input className={inputClass} value={form.fullName} onChange={set("fullName")} placeholder="Ex: Rahul Sharma" autoComplete="name" maxLength={80} />
                  </label>
                  <label className="block">
                    <span className={`mb-2 block text-xs font-extrabold uppercase tracking-[0.08em] ${t.label}`}>Mobile Number</span>
                    <input className={inputClass} value={form.phone} onChange={set("phone")} placeholder="Ex: 98765 43210" inputMode="numeric" autoComplete="tel" />
                  </label>
                  <label className="block">
                    <span className={`mb-2 block text-xs font-extrabold uppercase tracking-[0.08em] ${t.label}`}>City</span>
                    <input className={inputClass} value={form.city} onChange={set("city")} placeholder="Ex: Indore" autoComplete="address-level2" maxLength={80} />
                  </label>
                  {page.fields === "delivery" ? (
                    <label className="block">
                      <span className={`mb-2 block text-xs font-extrabold uppercase tracking-[0.08em] ${t.label}`}>Vehicle Type</span>
                      <select className={`${inputClass} appearance-none`} value={form.vehicleType} onChange={set("vehicleType")}>
                        <option value="" className="text-slate-900">Select your vehicle</option>
                        {VEHICLES.map((v) => (
                          <option key={v.value} value={v.value} className="text-slate-900">{v.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : page.fields === "franchise" ? (
                    <label className="block">
                      <span className={`mb-2 block text-xs font-extrabold uppercase tracking-[0.08em] ${t.label}`}>Franchise Name</span>
                      <input className={inputClass} value={form.restaurantName} onChange={set("restaurantName")} placeholder="Ex: CityFood Indore Hub" maxLength={120} />
                    </label>
                  ) : (
                    <label className="block">
                      <span className={`mb-2 block text-xs font-extrabold uppercase tracking-[0.08em] ${t.label}`}>Restaurant Name</span>
                      <input className={inputClass} value={form.restaurantName} onChange={set("restaurantName")} placeholder="Ex: The Spice Kitchen" maxLength={120} />
                    </label>
                  )}
                </div>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.99] disabled:opacity-70"
                    style={{ background: dark ? RED : "#0F172A" }}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Registration Request"}
                  </button>
                  <button type="button" onClick={() => navigate("/")} className={`rounded-2xl px-8 py-4 text-sm font-bold transition ${t.secondary}`}>
                    Return to Homepage
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      <footer className={`border-t py-8 text-center text-xs font-semibold ${t.footer}`}>
        © {new Date().getFullYear()} CityFood. All rights reserved.
      </footer>
    </div>
  )
}

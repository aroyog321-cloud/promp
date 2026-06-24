import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Shield, ArrowRight } from 'lucide-react'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    id: string
    name?: string | null
    email?: string | null
  }
}

const plansData = {
  Pro: {
    price: "$9",
    desc: "For power users who need more daily capacity.",
    features: ["50 Optimizations / day", "50 Regenerations / day", "Priority Support"],
    color: "from-blue-500/20 to-purple-500/20",
    border: "border-blue-500/30",
    text: "text-blue-400"
  },
  Expert: {
    price: "$25",
    desc: "Unlimited access with full context memory unlocked.",
    features: ["Unlimited Optimizations", "Unlimited Regenerations", "Context Memory Unlocked", "Priority Support"],
    color: "from-promptly-cyan/20 to-emerald-500/20",
    border: "border-promptly-cyan/30",
    text: "text-promptly-cyan"
  }
}

export default function UpgradeModal({ isOpen, onClose, user }: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'Pro' | 'Expert'>('Expert')
  const [selectedMethod, setSelectedMethod] = useState<string>('UPI')
  const [showEmailOptions, setShowEmailOptions] = useState(false)

  if (!isOpen) return null

  const methods = ['UPI', 'PayPal', 'Bank Transfer']

  function getEmailUrls(method: string, plan: string) {
    const rawSubject = `${plan} Access Request — ${method}`
    const shortId = user.id ? user.id.slice(0, 8) : 'unknown'
    const rawBody = `Hello,

I would like to request ${plan} access.

Payment Method:
${method}

Name:
${user.name || 'Not provided'}

Email:
${user.email || 'Not provided'}

User ID:
${shortId}

Please share payment details.

Thank you.`

    const subject = encodeURIComponent(rawSubject)
    const body = encodeURIComponent(rawBody)
    const to = 'upgrade@proenpt.com'

    return {
      gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`,
      outlook: `https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${subject}&body=${body}`,
      default: `mailto:${to}?subject=${subject}&body=${body}`
    }
  }

  function handleEmailClick(url: string) {
    window.open(url, '_blank')
    setShowEmailOptions(false)
    onClose()
  }

  const activePlan = plansData[selectedPlan]

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-xl bg-[#0f0f11] border border-white/[0.08] rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Ambient Header Glow */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
          
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04] relative z-10 shrink-0">
            <h2 className="text-xl font-semibold text-white tracking-tight">Upgrade Plan</h2>
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-white rounded-full hover:bg-white/[0.08] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto overflow-x-hidden flex-1 relative z-10 custom-scrollbar">
            
            {/* Plan Selector Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {(['Pro', 'Expert'] as const).map((plan) => {
                const isSelected = selectedPlan === plan
                const pData = plansData[plan]
                return (
                  <label
                    key={plan}
                    className={`relative flex flex-col p-5 rounded-2xl cursor-pointer transition-all duration-300 ${
                      isSelected 
                        ? `bg-gradient-to-br ${pData.color} border ${pData.border} shadow-[0_0_30px_rgba(0,0,0,0.2)]` 
                        : 'bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04]'
                    }`}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-semibold text-lg ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{plan}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected ? `border-${pData.text.split('-')[1]}-400 bg-white/10` : 'border-zinc-600'
                      }`}>
                        {isSelected && <div className={`w-2.5 h-2.5 rounded-full bg-${pData.text.split('-')[1]}-400`} />}
                      </div>
                    </div>
                    <div className="flex items-end gap-1">
                      <span className={`text-3xl font-bold tracking-tight ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                        {pData.price}
                      </span>
                      <span className={`text-sm mb-1 ${isSelected ? 'text-white/70' : 'text-zinc-600'}`}>/mo</span>
                    </div>
                  </label>
                )
              })}
            </div>

            {/* Dynamic Features List */}
            <motion.div 
              key={selectedPlan}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-8 p-5 rounded-2xl bg-black/40 border border-white/[0.03]"
            >
              <p className="text-sm text-zinc-400 mb-4">{activePlan.desc}</p>
              <ul className="space-y-3">
                {activePlan.features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-zinc-200">
                    <div className="mt-0.5 size-5 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                      <Check size={12} className={activePlan.text} />
                    </div>
                    {feat}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Payment Method */}
            <h3 className="text-sm font-medium text-zinc-400 mb-3 px-1 uppercase tracking-wider">Payment Method</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              {methods.map((method) => (
                <label
                  key={method}
                  className={`flex items-center justify-center gap-2 p-3.5 rounded-xl cursor-pointer border transition-all ${
                    selectedMethod === method
                      ? 'bg-promptly-cyan/15 border-promptly-cyan/40 text-promptly-cyan font-medium shadow-[0_0_15px_rgba(45,212,191,0.15)]'
                      : 'bg-white/[0.02] border-white/[0.05] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300'
                  }`}
                  onClick={() => setSelectedMethod(method)}
                >
                  <span className="text-sm text-center">{method}</span>
                </label>
              ))}
            </div>

            {/* Trust Copy & CTA */}
            <div className="flex flex-col gap-4 mt-auto shrink-0">
              <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border border-white/[0.04] rounded-xl text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Shield size={14} className="text-emerald-400" />
                  No payment details shown publicly
                </span>
                <span className="text-zinc-400">
                  Reply in <span className="text-promptly-cyan font-medium">&lt; 24h</span>
                </span>
              </div>

              <AnimatePresence mode="wait">
                {!showEmailOptions ? (
                  <motion.button
                    key="request-btn"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    onClick={() => setShowEmailOptions(true)}
                    className="group relative w-full py-4 bg-white text-black font-semibold rounded-xl transition-all overflow-hidden"
                  >
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-black/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                    <span className="relative flex items-center justify-center gap-2">
                      Request {selectedPlan} Access
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  </motion.button>
                ) : (
                  <motion.div
                    key="email-options"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-2"
                  >
                    <p className="text-xs text-zinc-400 text-center mb-1">Send request via:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleEmailClick(getEmailUrls(selectedMethod, selectedPlan).gmail)}
                        className="flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-colors text-sm font-medium"
                      >
                        Gmail
                      </button>
                      <button
                        onClick={() => handleEmailClick(getEmailUrls(selectedMethod, selectedPlan).outlook)}
                        className="flex items-center justify-center gap-2 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl transition-colors text-sm font-medium"
                      >
                        Outlook Web
                      </button>
                    </div>
                    <button
                      onClick={() => handleEmailClick(getEmailUrls(selectedMethod, selectedPlan).default)}
                      className="w-full py-3 bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 border border-white/[0.05] rounded-xl transition-colors text-sm font-medium mt-1"
                    >
                      Default Email App
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

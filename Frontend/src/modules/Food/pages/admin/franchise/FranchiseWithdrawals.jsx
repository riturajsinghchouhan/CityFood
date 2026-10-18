import { Wallet } from "lucide-react"
import WithdrawalRequests from "./WithdrawalRequests"

/** HQ page: every franchise's withdrawal requests in one place. */
export default function FranchiseWithdrawals() {
  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-7xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Franchise Withdrawals</h1>
            <p className="text-sm text-slate-600">Franchises ask for their earnings here. Pay them, then approve with the payment reference.</p>
          </div>
        </div>
        <WithdrawalRequests />
      </div>
    </div>
  )
}

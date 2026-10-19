// Referral link and sharing used by Profile.jsx and ReferEarn.jsx.
// navigator.share -> RN Share; the web fallbacks (clipboard, wa.me) run only if sharing fails.
import * as Clipboard from "expo-clipboard";
import { Linking, Share } from "react-native";
import { ASSET_ORIGIN } from "../../config";

export function buildReferralLink(userProfile) {
  const refId = userProfile?._id || userProfile?.id || userProfile?.referralCode || "";
  return refId ? `${ASSET_ORIGIN}/food/user/auth/login?ref=${encodeURIComponent(String(refId))}` : "";
}

export function referralShareText(companyName, rewardAmount) {
  const rewardText = rewardAmount > 0 ? `₹${rewardAmount}` : "rewards";
  return `Join ${companyName} and earn ${rewardText}.`;
}

/**
 * Opens the system share sheet. If that is unavailable, falls back like the web:
 * copy (when `copyFallback`) and open WhatsApp. Returns "shared" | "copied" | "whatsapp".
 */
export async function shareReferral({ companyName, text, link, copyFallback = false, onCopied }) {
  try {
    await Share.share({ title: `${companyName} referral`, message: `${text} ${link}` });
    return "shared";
  } catch {
    if (copyFallback) {
      await Clipboard.setStringAsync(`${text} ${link}`);
      onCopied?.();
    }
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`);
    return "whatsapp";
  }
}

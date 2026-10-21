// /signup is `<Navigate to="/food/delivery/login">` on web. The Profile referral link is
// /signup?ref=<riderId>, and the web loses `ref` on that redirect; here it is kept in storage and
// picked up by SignupDetailsScreen (sent as `ref` on register, which credits the referrer).
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { REFERRAL_KEY } from "../../components/auth/referral";
import { store } from "../../storage";

export default function SignupRedirect() {
  const { ref } = useLocalSearchParams();
  const refId = typeof ref === "string" ? ref.trim().slice(0, 64) : "";
  useEffect(() => {
    if (refId) store.set(REFERRAL_KEY, refId);
  }, [refId]);
  return <Redirect href="/login" />;
}

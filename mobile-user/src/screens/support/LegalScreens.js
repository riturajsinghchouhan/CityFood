// Terms.jsx, Privacy.jsx, Refund.jsx, Shipping.jsx and Cancellation.jsx: the same page,
// differing only in page key, titles, empty icon and back handling.
import { router, useLocalSearchParams } from "expo-router";
import { FileText, Lock, Receipt, Truck, XCircle } from "lucide-react-native";
import LegalPage from "../../components/support/LegalPage";
import { goTo, useAppBack } from "../../navigation/back";

// Web: window.history.length > 2 ? navigate(-1) : navigate("/food/user")
function historyBack() {
  if (router.canGoBack()) router.back();
  else goTo("/");
}

export function TermsScreen() {
  return (
    <LegalPage
      pageKey="terms"
      defaultTitle="Terms of Service"
      tagline="CityFood Policy"
      EmptyIcon={FileText}
      onBack={historyBack}
    />
  );
}

export function PrivacyScreen() {
  return (
    <LegalPage
      pageKey="privacy"
      defaultTitle="Privacy Policy"
      tagline="CityFood Policy"
      EmptyIcon={Lock}
      onBack={historyBack}
    />
  );
}

// Refund / Shipping: history.length > 2 ? goBack() (useAppBackNavigation) : navigate("/food/user")
function useAppHistoryBack() {
  const appBack = useAppBack();
  return () => {
    if (router.canGoBack()) appBack();
    else goTo("/");
  };
}

export function RefundScreen() {
  const onBack = useAppHistoryBack();
  return (
    <LegalPage
      pageKey="refund"
      defaultTitle="Refund Policy"
      tagline="CityFood Ecosystem"
      EmptyIcon={Receipt}
      onBack={onBack}
    />
  );
}

export function ShippingScreen() {
  const onBack = useAppHistoryBack();
  return (
    <LegalPage
      pageKey="shipping"
      defaultTitle="Shipping Policy"
      tagline="CityFood Ecosystem"
      EmptyIcon={Truck}
      onBack={onBack}
    />
  );
}

// Cancellation also honours state.returnTo (dining booking flow), passed here as a param.
export function CancellationScreen() {
  const { returnTo } = useLocalSearchParams();
  const fallback = useAppHistoryBack();
  const onBack = () => {
    if (typeof returnTo === "string" && returnTo.startsWith("/")) router.replace(returnTo);
    else fallback();
  };
  return (
    <LegalPage
      pageKey="cancellation"
      defaultTitle="Cancellation Policy"
      tagline="CityFood Ecosystem"
      EmptyIcon={XCircle}
      onBack={onBack}
    />
  );
}

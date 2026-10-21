// TermsAndConditionsV2 (/terms and /profile/terms): CMS "terms_delivery", falling back to "terms".
// Production returns data:null for both, so the web's "No terms content available." shows.
import { tw } from "../../theme/tokens";
import LegalPage from "../../components/content/LegalPage";

export default function TermsScreen() {
  return (
    <LegalPage
      kind="terms"
      title="Terms and Conditions"
      loadingText="Loading terms..."
      emptyText="No terms content available."
      arrowColor={tw.gray900}
      fixedHeader
    />
  );
}

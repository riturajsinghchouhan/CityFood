// PrivacyPolicyV2 (/profile/privacy): CMS "privacy_delivery", falling back to "privacy". With no
// content (production today) the web renders an empty block under the header, and so does this.
import { tw } from "../../theme/tokens";
import LegalPage from "../../components/content/LegalPage";

export default function PrivacyScreen() {
  return <LegalPage kind="privacy" title="Privacy Policy" loadingText="Loading policy..." arrowColor={tw.gray600} requireData />;
}

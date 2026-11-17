import LegalDocument from '@/newui/screens/LegalDocument';
import { BODY, TITLE } from '@/newui/content/privacyPolicy';

export default function PrivacyPolicy() {
  return (
    <LegalDocument
      title={TITLE}
      body={BODY}
      say="Privacy Policy. How Palpeer collects, uses, and protects your information."
    />
  );
}

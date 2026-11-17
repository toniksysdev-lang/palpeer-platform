import LegalDocument from '@/newui/screens/LegalDocument';
import { BODY, TITLE } from '@/newui/content/termsOfService';

export default function Terms() {
  return (
    <LegalDocument
      title={TITLE}
      body={BODY}
      say="Terms and Conditions. Read Palpeer terms for using the app and services."
    />
  );
}

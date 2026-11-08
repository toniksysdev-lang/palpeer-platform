import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy security-questions route → design StartQuestions. */
export default function SecurityQuestionsRedirect() {
  const { required, setupRequired, returnTo } = useLocalSearchParams<{
    required?: string;
    setupRequired?: string;
    returnTo?: string;
  }>();
  const setup = required === '1' || setupRequired === '1';
  return (
    <Redirect
      href={{
        pathname: '/StartQuestions',
        params: {
          ...(setup ? { setupRequired: '1' } : {}),
          ...(returnTo && typeof returnTo === 'string' ? { returnTo } : {}),
        },
      }}
    />
  );
}

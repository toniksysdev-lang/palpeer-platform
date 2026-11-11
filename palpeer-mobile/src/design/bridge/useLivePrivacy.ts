import { useCallback } from 'react';
import { router, type Href } from 'expo-router';

import { appConfig } from '@/config/env';
import { openExternal, supportMailto } from '@/features/support/appInfo';
import { useToast } from '@/providers/ToastProvider';

/** Live props for design Privacy screen. */
export function useLivePrivacy() {
  const toast = useToast();
  const privacyPolicyUrl = appConfig.support.privacyPolicyUrl;
  const termsUrl = appConfig.support.termsUrl;
  const supportEmail = appConfig.support.email;

  const onOpenUrl = useCallback(
    async (url: string, fallback = "This link couldn't be opened.") => {
      if (!(await openExternal(url))) toast.show({ type: 'error', title: fallback });
    },
    [toast],
  );

  const onOpenNotifications = useCallback(() => {
    router.push('/NotificationSettings' as Href);
  }, []);

  const onDeleteAccount = useCallback(async () => {
    if (!supportEmail) return;
    await onOpenUrl(
      supportMailto(supportEmail, 'Account deletion request'),
      `No email app found. Write to ${supportEmail}.`,
    );
  }, [onOpenUrl, supportEmail]);

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/More' as Href);
  }, []);

  return {
    backend: true as const,
    privacyPolicyUrl,
    termsUrl,
    supportEmail,
    onOpenUrl,
    onOpenNotifications,
    onDeleteAccount,
    onBack,
  };
}

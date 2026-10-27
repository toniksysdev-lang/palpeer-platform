import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Skeleton } from '@/components/ui/Skeleton';

type TotpQrCodeProps = {
  /** Full `otpauth://totp/...` URI from the MFA setup API. */
  otpauthUrl: string;
  /** Rendered square size in CSS pixels. */
  size?: number;
  className?: string;
};

/**
 * Renders a Google Authenticator–compatible QR code entirely in-browser.
 * Secrets never leave the device (no third-party QR image APIs).
 */
export function TotpQrCode({ otpauthUrl, size = 200, className }: TotpQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setError(null);

    if (!otpauthUrl.startsWith('otpauth://')) {
      setError('Invalid authenticator setup URL.');
      return;
    }

    void QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: size * 2, // sharper on retina
      color: {
        // Always black-on-white — scanners fail on dark-theme inverted codes.
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError('Could not generate QR code. Use the manual key below.');
      });

    return () => {
      cancelled = true;
    };
  }, [otpauthUrl, size]);

  if (error) {
    return (
      <p className="text-sm text-danger" role="alert">
        {error}
      </p>
    );
  }

  if (!dataUrl) {
    return (
      <div style={{ width: size, height: size }}>
        <Skeleton className="h-full w-full rounded-[0.6rem]" />
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt="QR code to scan with Google Authenticator"
      className={className ?? 'rounded-[0.6rem] border border-border bg-white p-2'}
      draggable={false}
    />
  );
}

/** Groups a Base32 secret for easier manual entry (XXXX XXXX …). */
export function formatTotpSecret(secret: string): string {
  const compact = secret.replace(/\s+/g, '').toUpperCase();
  return compact.replace(/(.{4})(?=.)/g, '$1 ');
}

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Drawer } from '@/components/dialogs/Drawer';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { mockKycDocumentContent, mockKycSelfieContent } from '@/mocks/kyc';
import { saveBlob, type BinaryResponse } from '@/services/api/client';
import { getKycDocumentContent, getKycSelfieContent } from '@/services/api/kyc';
import { ApiClientError } from '@/types/api';

export type KycPreviewTarget =
  | { kind: 'document'; caseId: string; id: string; title: string; filename?: string | null }
  | { kind: 'selfie'; caseId: string; id: string; title: string; filename?: string | null };

type PreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; url: string; contentType: string; blob: Blob; filename: string | null };

async function loadContent(target: KycPreviewTarget, signal: AbortSignal): Promise<BinaryResponse> {
  if (appConfig.useMockApi) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return target.kind === 'document'
      ? mockKycDocumentContent(target.caseId, target.id)
      : mockKycSelfieContent(target.caseId);
  }
  return target.kind === 'document'
    ? getKycDocumentContent(target.caseId, target.id, signal)
    : getKycSelfieContent(target.caseId, signal);
}

export function KycPreviewDrawer({
  target,
  onClose,
}: {
  target: KycPreviewTarget | null;
  onClose: () => void;
}) {
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setState({ status: 'loading' });

    loadContent(target, controller.signal)
      .then((content) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(content.blob);
        setState({
          status: 'ready',
          url: objectUrl,
          contentType: content.contentType.split(';')[0]!.trim().toLowerCase(),
          blob: content.blob,
          filename: content.filename ?? target.filename ?? null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          message:
            error instanceof ApiClientError ? error.message : 'Failed to load the file content.',
        });
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setState({ status: 'loading' });
    };
  }, [target, attempt]);

  return (
    <Drawer open={Boolean(target)} title={target?.title ?? 'Preview'} wide onClose={onClose}>
      {state.status === 'loading' ? (
        <Skeleton className="h-80 w-full" />
      ) : state.status === 'error' ? (
        <ErrorState description={state.message} onRetry={() => setAttempt((value) => value + 1)} />
      ) : (
        <div className="space-y-3">
          {state.contentType.startsWith('image/') ? (
            <img
              src={state.url}
              alt={target?.title ?? 'KYC file'}
              className="max-h-[70vh] w-full rounded-[0.6rem] border border-border object-contain"
            />
          ) : state.contentType === 'application/pdf' ? (
            <object
              data={state.url}
              type="application/pdf"
              aria-label={target?.title ?? 'KYC PDF'}
              className="h-[70vh] w-full rounded-[0.6rem] border border-border"
            >
              <p className="p-4 text-sm text-text-secondary">
                This browser cannot display PDFs inline. Use Download instead.
              </p>
            </object>
          ) : (
            <p className="text-sm text-text-secondary">
              Inline preview is not supported for {state.contentType}. Use Download instead.
            </p>
          )}
          <div className="flex items-center justify-between gap-3 text-xs text-text-muted">
            <span className="font-mono">{state.contentType}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => saveBlob(state.blob, state.filename ?? `kyc-${target?.id ?? 'file'}`)}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Download
            </Button>
          </div>
          <p className="text-xs text-text-muted">
            Each view is recorded in the audit log. Close the drawer when finished; the local copy is
            discarded.
          </p>
        </div>
      )}
    </Drawer>
  );
}

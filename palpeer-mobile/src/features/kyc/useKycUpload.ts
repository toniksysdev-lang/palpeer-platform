import { useCallback, useEffect, useRef, useState } from 'react';

import type { AppError } from '@/services/api/errors';
import { baseApi } from '@/services/api/baseApi';
import { uploadMultipart, type UploadFile } from '@/services/api/upload';
import { useAppDispatch } from '@/store';
import type { KycDocumentResponse, SelfieResponse } from '@/types/api/kyc';

export type KycUploadTarget = { kind: 'document'; documentType: string } | { kind: 'selfie' };

export type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | { status: 'success' }
  | { status: 'error'; error: AppError };

/**
 * Uploads a KYC document or selfie with progress. Retrying simply calls `upload` again with the
 * same file; the backend keeps every upload and verification uses the latest one.
 */
export function useKycUpload(target: KycUploadTarget) {
  const dispatch = useAppDispatch();
  const kind = target.kind;
  const documentType = target.kind === 'document' ? target.documentType : null;
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const upload = useCallback(
    async (file: UploadFile): Promise<boolean> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ status: 'uploading', progress: 0 });

      const onProgress = (progress: number) => {
        if (!controller.signal.aborted) setState({ status: 'uploading', progress });
      };
      const result =
        kind === 'document'
          ? await uploadMultipart<KycDocumentResponse>('/kyc/documents', {
              fields: { documentType: documentType ?? '' },
              file,
              onProgress,
              signal: controller.signal,
            })
          : await uploadMultipart<SelfieResponse>('/kyc/selfie', {
              file,
              onProgress,
              signal: controller.signal,
            });

      if (controller.signal.aborted) return false;
      if (result.ok) {
        dispatch(baseApi.util.invalidateTags(['KycStatus']));
        setState({ status: 'success' });
        return true;
      }
      setState({ status: 'error', error: result.error });
      return false;
    },
    [dispatch, kind, documentType],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: 'idle' });
  }, []);

  return { state, upload, reset };
}

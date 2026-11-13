import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import type { View } from 'react-native';

import { isTransactionType, transactionPollMs } from '@/features/transactions/logic';
import {
  saveReceiptContentAsImage,
  saveReceiptContentAsPdf,
  type ReceiptContent,
} from '@/features/transactions/saveReceipt';
import { toAppError } from '@/services/api/errors';
import { useGetTransactionQuery } from '@/services/api/transactionApi';
import {
  useGetFundingQuery,
  useGetWithdrawalBanksQuery,
  useGetWithdrawalQuery,
} from '@/services/api/walletApi';
import { useToast } from '@/providers/ToastProvider';
import { useAppSelector } from '@/store';
import type { TransactionItemResponse } from '@/types/api/transaction';

import {
  mapHistoryItem,
  withFundingDetails,
  withWithdrawalDestination,
  type HistoryListItem,
} from './useLiveHistory';

function toReceiptContent(detail: HistoryListItem): ReceiptContent {
  return {
    title: detail.title,
    rows: detail.rows.map(([label, value]) => ({ label, value })),
    status: detail.status,
    note: detail.note,
    when: detail.when,
    steps: detail.steps,
  };
}

/** Live receipt for Messages → See details (`/transaction/:type/:id`). */
export function useLiveTransactionDetail(typeRaw: string, idRaw: string) {
  const toast = useToast();
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const type = isTransactionType(typeRaw) ? typeRaw : null;
  const id = idRaw?.trim() || null;
  const selected =
    type && id && authenticated ? ({ type, id } as Pick<TransactionItemResponse, 'type' | 'id'>) : null;

  const [savingFormat, setSavingFormat] = useState<'image' | 'pdf' | null>(null);

  const firstDetail = useGetTransactionQuery(selected ?? skipToken);
  const detailQ = useGetTransactionQuery(selected ?? skipToken, {
    pollingInterval: transactionPollMs(firstDetail.data),
    skipPollingIfUnfocused: true,
  });
  const firstFunding = useGetFundingQuery(
    selected?.type === 'FUNDING' ? selected.id : skipToken,
  );
  const fundingQ = useGetFundingQuery(selected?.type === 'FUNDING' ? selected.id : skipToken, {
    pollingInterval: transactionPollMs(
      firstFunding.data
        ? ({ type: 'FUNDING', status: firstFunding.data.status } as TransactionItemResponse)
        : undefined,
    ),
    skipPollingIfUnfocused: true,
  });
  const firstWithdrawal = useGetWithdrawalQuery(
    selected?.type === 'WITHDRAWAL' ? selected.id : skipToken,
  );
  const withdrawalQ = useGetWithdrawalQuery(
    selected?.type === 'WITHDRAWAL' ? selected.id : skipToken,
    {
      pollingInterval: transactionPollMs(
        firstWithdrawal.data
          ? ({ type: 'WITHDRAWAL', status: firstWithdrawal.data.status } as TransactionItemResponse)
          : undefined,
      ),
      skipPollingIfUnfocused: true,
    },
  );
  const banksQ = useGetWithdrawalBanksQuery(
    selected?.type === 'WITHDRAWAL' ? undefined : skipToken,
  );

  const now = Date.now();

  const bankNameForWithdrawal = useMemo(() => {
    const reference = withdrawalQ.data?.destinationReference;
    if (!reference || withdrawalQ.data?.currencyCode !== 'NGN') return null;
    const [bankCode] = reference.split(/[:|;]/);
    return banksQ.data?.find((b) => b.code === bankCode)?.name ?? null;
  }, [banksQ.data, withdrawalQ.data?.currencyCode, withdrawalQ.data?.destinationReference]);

  const detail = useMemo(() => {
    if (!selected || !detailQ.data) return null;
    const base = mapHistoryItem(detailQ.data, now);
    if (base.type === 'FUNDING') return withFundingDetails(base, fundingQ.data);
    if (base.type !== 'WITHDRAWAL') return base;
    const currencyCode = detailQ.data.currencyCode ?? withdrawalQ.data?.currencyCode;
    const destinationReference = withdrawalQ.data?.destinationReference;
    if (!currencyCode || destinationReference == null) return base;
    return {
      ...base,
      rows: withWithdrawalDestination(
        base.rows,
        currencyCode,
        destinationReference,
        bankNameForWithdrawal,
      ),
    };
  }, [
    bankNameForWithdrawal,
    detailQ.data,
    fundingQ.data,
    now,
    selected,
    withdrawalQ.data?.currencyCode,
    withdrawalQ.data?.destinationReference,
  ]);

  const detailLoading =
    !!selected &&
    !detail &&
    !detailQ.error &&
    (detailQ.isLoading ||
      (selected.type === 'FUNDING' && fundingQ.isLoading) ||
      (selected.type === 'WITHDRAWAL' && withdrawalQ.isLoading));

  const errorMessage = useMemo(() => {
    if (!type || !id) return "This link doesn't point to a transaction.";
    if (!detailQ.error) return null;
    return toAppError(detailQ.error).message ?? 'Could not load this transaction.';
  }, [detailQ.error, id, type]);

  const onSaveImage = useCallback(
    async (ref: RefObject<View | null>) => {
      if (!detail || savingFormat) return;
      setSavingFormat('image');
      try {
        await saveReceiptContentAsImage(
          toReceiptContent(detail),
          `palpeer-${detail.type}-${detail.id}`,
          ref,
        );
      } catch {
        toast.show({ type: 'error', title: "Couldn't save image" });
      } finally {
        setSavingFormat(null);
      }
    },
    [detail, savingFormat, toast],
  );

  const onSavePdf = useCallback(
    async (_ref: RefObject<View | null>) => {
      if (!detail || savingFormat) return;
      setSavingFormat('pdf');
      try {
        await saveReceiptContentAsPdf(
          toReceiptContent(detail),
          `palpeer-${detail.type}-${detail.id}`,
        );
      } catch {
        toast.show({ type: 'error', title: "Couldn't save PDF" });
      } finally {
        setSavingFormat(null);
      }
    },
    [detail, savingFormat, toast],
  );

  const onRetry = useCallback(() => {
    void detailQ.refetch();
    if (selected?.type === 'FUNDING') void fundingQ.refetch();
    if (selected?.type === 'WITHDRAWAL') void withdrawalQ.refetch();
  }, [detailQ, fundingQ, selected?.type, withdrawalQ]);

  return {
    backend: true as const,
    detail,
    detailLoading,
    errorMessage,
    onRetry,
    onSaveImage,
    onSavePdf,
    savingFormat,
    canSave: !!detail,
  };
}

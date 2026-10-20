import { mockAuditCatalog } from '@/mocks/audit';
import { mockListCards } from '@/mocks/cards';
import { mockListKycCases } from '@/mocks/kyc';
import { mockListP2POrders, mockListP2PRequests } from '@/mocks/p2p';
import { mockListAdminBonuses, mockListAdminReferrals } from '@/mocks/promotions';
import { mockSearchTransactions } from '@/mocks/transactions';
import { mockUsersCatalog } from '@/mocks/users';
import { mockListWallets } from '@/mocks/wallets';
import type { BinaryResponse } from '@/services/api/client';
import type {
  AdminReportsSummary,
  CountsByKey,
  ReportDataset,
  ReportWindow,
} from '@/types/reports';

const ALL = { page: 0, size: 1000 };

function countBy<T>(rows: T[], key: (row: T) => string): CountsByKey {
  return rows.reduce<CountsByKey>((acc, row) => {
    const value = key(row);
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function sumDecimal(values: Array<string | number | null | undefined>): string {
  return values.reduce<number>((acc, value) => acc + Number(value ?? 0), 0).toFixed(2);
}

function resolveWindow(window: ReportWindow): { from: string; to: string } {
  const to = window.to ?? new Date().toISOString();
  const from = window.from ?? new Date(Date.parse(to) - 30 * 86400000).toISOString();
  return { from, to };
}

function inWindow(createdAt: string, from: string, to: string): boolean {
  const at = Date.parse(createdAt);
  return at >= Date.parse(from) && at <= Date.parse(to);
}

export function mockReportsSummary(window: ReportWindow = {}): AdminReportsSummary {
  const { from, to } = resolveWindow(window);
  const kycCases = mockListKycCases(ALL).content;
  const wallets = mockListWallets(ALL).content;
  const transactions = mockSearchTransactions({ from, to, page: 0, size: 1000 }).items;
  const bonuses = mockListAdminBonuses(ALL).content;

  const balances = new Map<string, typeof wallets>();
  for (const wallet of wallets) {
    balances.set(wallet.currencyCode, [...(balances.get(wallet.currencyCode) ?? []), wallet]);
  }

  const volume = new Map<string, { type: string; currencyCode: string; count: number; amounts: Array<string | number | null | undefined> }>();
  for (const tx of transactions.filter((row) => row.status === 'SUCCESS')) {
    const currencyCode = tx.currencyCode ?? 'N/A';
    const key = `${tx.type}:${currencyCode}`;
    const entry = volume.get(key) ?? { type: tx.type, currencyCode, count: 0, amounts: [] };
    entry.count += 1;
    entry.amounts.push(tx.amount);
    volume.set(key, entry);
  }

  const bonusAmounts = new Map<string, { status: string; currencyCode: string; amounts: Array<string | number> }>();
  for (const bonus of bonuses) {
    const key = `${bonus.status}:${bonus.currencyCode}`;
    const entry = bonusAmounts.get(key) ?? { status: String(bonus.status), currencyCode: bonus.currencyCode, amounts: [] };
    entry.amounts.push(bonus.amount);
    bonusAmounts.set(key, entry);
  }

  return {
    generatedAt: new Date().toISOString(),
    from,
    to,
    users: { total: mockUsersCatalog.length, byStatus: countBy(mockUsersCatalog, (row) => row.status) },
    kyc: { total: kycCases.length, byStatus: countBy(kycCases, (row) => row.status) },
    wallets: {
      total: wallets.length,
      balancesByCurrency: [...balances.entries()].map(([currencyCode, rows]) => ({
        currencyCode,
        walletCount: rows.length,
        availableTotal: sumDecimal(rows.map((row) => row.availableBalance)),
        pendingTotal: sumDecimal(rows.map((row) => row.pendingBalance)),
      })),
    },
    transactions: {
      countsByType: countBy(transactions, (row) => row.type),
      countsByTypeAndStatus: countBy(transactions, (row) => `${row.type}:${row.status}`),
      successVolume: [...volume.values()].map((entry) => ({
        type: entry.type,
        currencyCode: entry.currencyCode,
        count: entry.count,
        amount: sumDecimal(entry.amounts),
      })),
    },
    p2p: {
      requestsByStatus: countBy(mockListP2PRequests(), (row) => row.status),
      ordersByStatus: countBy(mockListP2POrders(), (row) => row.status),
    },
    cards: { byStatus: countBy(mockListCards(ALL).content, (row) => row.status) },
    referrals: { byStatus: countBy(mockListAdminReferrals(ALL).content, (row) => String(row.status)) },
    bonuses: {
      byStatus: countBy(bonuses, (row) => String(row.status)),
      amountByStatusAndCurrency: [...bonusAmounts.values()].map((entry) => ({
        status: entry.status,
        currencyCode: entry.currencyCode,
        amount: sumDecimal(entry.amounts),
      })),
    },
    fees: {
      orderCount: mockListP2POrders().filter((row) => row.status === 'COMPLETED').length,
      byCurrency: [
        { currencyCode: 'NGN', count: 2, amount: '1500.00' },
        { currencyCode: 'CAD', count: 1, amount: '12.50' },
      ],
    },
  };
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header: string[], rows: unknown[][]): string {
  return [header.join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n');
}

export function mockExportReportDataset(
  dataset: ReportDataset,
  window: ReportWindow = {},
): BinaryResponse {
  const { from, to } = resolveWindow(window);
  const within = (createdAt?: string | null) => !createdAt || inWindow(createdAt, from, to);
  let csv: string;
  switch (dataset) {
    case 'users':
      csv = toCsv(
        ['id', 'email', 'status', 'enabled', 'createdAt'],
        mockUsersCatalog
          .filter((row) => within(row.createdAt))
          .map((row) => [row.id, row.email, row.status, row.enabled, row.createdAt]),
      );
      break;
    case 'kyc-cases':
      csv = toCsv(
        ['caseId', 'userId', 'status', 'rejectionReason', 'createdAt', 'updatedAt'],
        mockListKycCases(ALL)
          .content.filter((row) => within(row.createdAt))
          .map((row) => [row.caseId, row.userId, row.status, row.rejectionReason, row.createdAt, row.updatedAt]),
      );
      break;
    case 'wallets':
      csv = toCsv(
        ['id', 'userId', 'currencyCode', 'availableBalance', 'pendingBalance'],
        mockListWallets(ALL).content.map((row) => [
          row.id,
          row.userId,
          row.currencyCode,
          row.availableBalance,
          row.pendingBalance,
        ]),
      );
      break;
    case 'transactions':
      csv = toCsv(
        ['type', 'id', 'userId', 'status', 'currencyCode', 'amount', 'createdAt'],
        mockSearchTransactions({ from, to, page: 0, size: 1000 }).items.map((row) => [
          row.type,
          row.id,
          row.userId,
          row.status,
          row.currencyCode,
          row.amount,
          row.createdAt,
        ]),
      );
      break;
    case 'p2p-requests':
      csv = toCsv(
        ['id', 'userId', 'side', 'base', 'quote', 'amount', 'rate', 'status', 'createdAt'],
        mockListP2PRequests()
          .filter((row) => within(row.createdAt))
          .map((row) => [
            row.id,
            row.userId,
            row.side,
            row.baseCurrencyCode,
            row.quoteCurrencyCode,
            row.amount,
            row.rate,
            row.status,
            row.createdAt,
          ]),
      );
      break;
    case 'p2p-orders':
      csv = toCsv(
        ['id', 'requestId', 'requesterId', 'acceptorId', 'amount', 'rate', 'status', 'createdAt'],
        mockListP2POrders()
          .filter((row) => within(row.createdAt))
          .map((row) => [
            row.id,
            row.requestId,
            row.requesterId,
            row.acceptorId,
            row.amount,
            row.rate,
            row.status,
            row.createdAt,
          ]),
      );
      break;
    case 'audit-logs':
      csv = toCsv(
        ['id', 'createdAt', 'userRef', 'action', 'entity'],
        mockAuditCatalog
          .filter((row) => within(row.createdAt))
          .map((row) => [row.id, row.createdAt, row.userRef, row.action, row.entity]),
      );
      break;
  }
  return { blob: new Blob([csv], { type: 'text/csv' }), contentType: 'text/csv', filename: null };
}

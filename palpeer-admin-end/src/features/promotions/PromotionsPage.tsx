import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BadgePercent } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import {
  mockCreatePromotion,
  mockListActivePromotions,
  mockUpdatePromotion,
} from '@/mocks/promotions';
import { mockListCurrencies } from '@/mocks/rates';
import { listCurrencies } from '@/services/api/currencies';
import {
  createPromotion,
  getAdminPromotion,
  listActivePromotions,
  updatePromotion,
  updatePromotionCampaign,
} from '@/services/api/promotions';
import { ApiClientError } from '@/types/api';
import {
  PROMOTION_TYPES,
  type PromotionEligibility,
  type PromotionFormula,
  type PromotionSummary,
  type PromotionType,
} from '@/types/promotions';

const promotionFormSchema = z.object({
  code: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  promotionType: z.enum(PROMOTION_TYPES),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  bonusAmount: z.string().optional(),
  bonusCurrencyCode: z.string().trim().max(200).optional(),
});

function localToIso(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function isoToLocal(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function splitCurrencyCodes(raw?: string | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,\s]+/)
        .map((part) => part.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

function parseEligibility(raw?: string | null): PromotionEligibility {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PromotionEligibility;
  } catch {
    return {};
  }
}

function buildEligibilityJson(
  base: PromotionEligibility,
  referrerBonusRequiresInviteeTrade: boolean,
): string | null {
  const next: PromotionEligibility = { ...base };
  if (referrerBonusRequiresInviteeTrade) {
    next.referrerBonusRequiresInviteeTrade = true;
  } else {
    delete next.referrerBonusRequiresInviteeTrade;
  }
  if (
    next.minKycLevel == null &&
    next.minCompletedOrders == null &&
    !next.countries &&
    !next.referrerBonusRequiresInviteeTrade
  ) {
    return null;
  }
  return JSON.stringify(next);
}

export function PromotionsPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const canWrite = can('promotions:write');

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [promotionType, setPromotionType] = useState<PromotionType>('CAMPAIGN');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusCurrencies, setBonusCurrencies] = useState<string[]>([]);
  const [referrerRequiresInviteeTrade, setReferrerRequiresInviteeTrade] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPromotionType, setEditPromotionType] = useState<PromotionType>('CAMPAIGN');
  const [editActive, setEditActive] = useState(true);
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editEndsAt, setEditEndsAt] = useState('');
  const [editBonusAmount, setEditBonusAmount] = useState('');
  const [editBonusCurrencies, setEditBonusCurrencies] = useState<string[]>([]);
  const [editReferrerRequiresInviteeTrade, setEditReferrerRequiresInviteeTrade] = useState(false);
  const [editEligibilityBase, setEditEligibilityBase] = useState<PromotionEligibility>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [campaignPromotionId, setCampaignPromotionId] = useState('');
  const [formulaType, setFormulaType] = useState<PromotionFormula['type']>('FLAT');
  const [formulaValue, setFormulaValue] = useState('');
  const [minKycLevel, setMinKycLevel] = useState('');
  const [minCompletedOrders, setMinCompletedOrders] = useState('');
  const [countriesCsv, setCountriesCsv] = useState('');
  const [campaignReferrerRequiresInviteeTrade, setCampaignReferrerRequiresInviteeTrade] =
    useState(false);
  const [campaignBusy, setCampaignBusy] = useState(false);

  const listQuery = useQuery({
    queryKey: ['promotions-active', appConfig.useMockApi],
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return mockListActivePromotions();
      }
      return listActivePromotions();
    },
  });

  const currenciesQuery = useQuery({
    queryKey: ['currencies', appConfig.useMockApi],
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return mockListCurrencies();
      }
      return listCurrencies();
    },
  });

  const currencyOptions = useMemo(
    () => [...(currenciesQuery.data ?? [])].sort((a, b) => a.code.localeCompare(b.code)),
    [currenciesQuery.data],
  );

  function beginEdit(row: PromotionSummary) {
    setEditingId(row.id);
    setEditCode(row.code);
    setEditTitle(row.title);
    setEditDescription(row.description ?? '');
    setEditPromotionType(
      PROMOTION_TYPES.includes(row.promotionType as PromotionType)
        ? (row.promotionType as PromotionType)
        : 'CAMPAIGN',
    );
    setEditActive(row.active);
    setEditStartsAt(isoToLocal(row.startsAt));
    setEditEndsAt(isoToLocal(row.endsAt));
    setEditBonusAmount(row.bonusAmount != null ? String(row.bonusAmount) : '');
    setEditBonusCurrencies(splitCurrencyCodes(row.bonusCurrencyCode));
    const eligibility = parseEligibility(row.eligibilityJson);
    setEditEligibilityBase(eligibility);
    setEditReferrerRequiresInviteeTrade(!!eligibility.referrerBonusRequiresInviteeTrade);
    setEditErrors({});
  }

  function cancelEdit() {
    setEditingId(null);
    setEditConfirmOpen(false);
    setEditErrors({});
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const bonusCurrencyCode =
        bonusCurrencies.length > 0 ? bonusCurrencies.join(',') : undefined;
      const parsed = promotionFormSchema.safeParse({
        code,
        title,
        description: description || undefined,
        promotionType,
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
        bonusAmount: bonusAmount || undefined,
        bonusCurrencyCode,
      });
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          next[String(issue.path[0] ?? 'form')] = issue.message;
        }
        setErrors(next);
        throw new ApiClientError(400, 'VALIDATION_FAILED', 'Fix the highlighted fields.');
      }
      if (parsed.data.bonusAmount && !bonusCurrencyCode) {
        setErrors({ bonusCurrencyCode: 'Select at least one currency when bonus amount is set.' });
        throw new ApiClientError(400, 'VALIDATION_FAILED', 'Fix the highlighted fields.');
      }
      setErrors({});
      const eligibilityJson =
        parsed.data.promotionType === 'REFERRAL'
          ? buildEligibilityJson({}, referrerRequiresInviteeTrade)
          : null;
      const payload = {
        ...parsed.data,
        startsAt: localToIso(parsed.data.startsAt) ?? null,
        endsAt: localToIso(parsed.data.endsAt) ?? null,
        bonusAmount: parsed.data.bonusAmount ?? null,
        bonusCurrencyCode: parsed.data.bonusCurrencyCode ?? null,
        eligibilityJson,
      };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return mockCreatePromotion(payload);
      }
      return createPromotion(payload);
    },
    onSuccess: async (created) => {
      setConfirmOpen(false);
      push({
        tone: 'success',
        title: 'Promotion created',
        description: `${created.code} has been created.`,
      });
      setCode('');
      setTitle('');
      setDescription('');
      setBonusAmount('');
      setBonusCurrencies([]);
      setReferrerRequiresInviteeTrade(false);
      setStartsAt('');
      setEndsAt('');
      await queryClient.invalidateQueries({ queryKey: ['promotions-active'] });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Create failed',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) {
        throw new ApiClientError(400, 'VALIDATION_FAILED', 'No promotion selected.');
      }
      const bonusCurrencyCode =
        editBonusCurrencies.length > 0 ? editBonusCurrencies.join(',') : undefined;
      const parsed = promotionFormSchema.safeParse({
        code: editCode,
        title: editTitle,
        description: editDescription || undefined,
        promotionType: editPromotionType,
        startsAt: editStartsAt || undefined,
        endsAt: editEndsAt || undefined,
        bonusAmount: editBonusAmount || undefined,
        bonusCurrencyCode,
      });
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          next[String(issue.path[0] ?? 'form')] = issue.message;
        }
        setEditErrors(next);
        throw new ApiClientError(400, 'VALIDATION_FAILED', 'Fix the highlighted fields.');
      }
      if (parsed.data.bonusAmount && !bonusCurrencyCode) {
        setEditErrors({
          bonusCurrencyCode: 'Select at least one currency when bonus amount is set.',
        });
        throw new ApiClientError(400, 'VALIDATION_FAILED', 'Fix the highlighted fields.');
      }
      setEditErrors({});
      const eligibilityJson =
        parsed.data.promotionType === 'REFERRAL'
          ? buildEligibilityJson(editEligibilityBase, editReferrerRequiresInviteeTrade)
          : buildEligibilityJson(
              { ...editEligibilityBase, referrerBonusRequiresInviteeTrade: undefined },
              false,
            );
      const payload = {
        ...parsed.data,
        active: editActive,
        startsAt: localToIso(parsed.data.startsAt) ?? null,
        endsAt: localToIso(parsed.data.endsAt) ?? null,
        bonusAmount: parsed.data.bonusAmount ?? null,
        bonusCurrencyCode: parsed.data.bonusCurrencyCode ?? null,
        eligibilityJson,
      };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return mockUpdatePromotion(editingId, payload);
      }
      return updatePromotion(editingId, payload);
    },
    onSuccess: async (updated) => {
      setEditConfirmOpen(false);
      push({
        tone: 'success',
        title: 'Promotion updated',
        description: `${updated.code} has been saved.`,
      });
      cancelEdit();
      await queryClient.invalidateQueries({ queryKey: ['promotions-active'] });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Update failed',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    },
  });

  async function loadCampaignConfig(promotionId: string) {
    setCampaignPromotionId(promotionId);
    if (!promotionId) return;
    setCampaignBusy(true);
    try {
      const row =
        appConfig.useMockApi
          ? (listQuery.data ?? []).find((p) => p.id === promotionId)
          : await getAdminPromotion(promotionId);
      if (!row) return;
      if (row.formulaJson) {
        try {
          const parsed = JSON.parse(row.formulaJson) as PromotionFormula;
          setFormulaType(parsed.type === 'PERCENT' ? 'PERCENT' : 'FLAT');
          setFormulaValue(parsed.value != null ? String(parsed.value) : '');
        } catch {
          setFormulaValue('');
        }
      } else {
        setFormulaType('FLAT');
        setFormulaValue('');
      }
      if (row.eligibilityJson) {
        try {
          const parsed = JSON.parse(row.eligibilityJson) as PromotionEligibility;
          setMinKycLevel(parsed.minKycLevel != null ? String(parsed.minKycLevel) : '');
          setMinCompletedOrders(
            parsed.minCompletedOrders != null ? String(parsed.minCompletedOrders) : '',
          );
          setCountriesCsv(parsed.countries ?? '');
          setCampaignReferrerRequiresInviteeTrade(!!parsed.referrerBonusRequiresInviteeTrade);
        } catch {
          setMinKycLevel('');
          setMinCompletedOrders('');
          setCountriesCsv('');
          setCampaignReferrerRequiresInviteeTrade(false);
        }
      } else {
        setMinKycLevel('');
        setMinCompletedOrders('');
        setCountriesCsv('');
        setCampaignReferrerRequiresInviteeTrade(false);
      }
    } catch (error) {
      push({
        tone: 'error',
        title: 'Could not load campaign rules',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    } finally {
      setCampaignBusy(false);
    }
  }

  async function saveCampaignConfig() {
    if (!campaignPromotionId || !canWrite) return;
    const formulaJson = JSON.stringify({
      type: formulaType,
      value: formulaValue.trim() ? Number(formulaValue) : 0,
    });
    const eligibility: PromotionEligibility = {};
    if (minKycLevel.trim()) eligibility.minKycLevel = Number(minKycLevel);
    if (minCompletedOrders.trim()) eligibility.minCompletedOrders = Number(minCompletedOrders);
    if (countriesCsv.trim()) eligibility.countries = countriesCsv.trim().toUpperCase();
    if (campaignReferrerRequiresInviteeTrade) {
      eligibility.referrerBonusRequiresInviteeTrade = true;
    }
    const eligibilityJson = JSON.stringify(eligibility);
    setCampaignBusy(true);
    try {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      } else {
        await updatePromotionCampaign(campaignPromotionId, { formulaJson, eligibilityJson });
      }
      push({ tone: 'success', title: 'Campaign rules saved' });
      await queryClient.invalidateQueries({ queryKey: ['promotions-active'] });
    } catch (error) {
      push({
        tone: 'error',
        title: 'Save failed',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    } finally {
      setCampaignBusy(false);
    }
  }

  const columns = useMemo<DataColumn<PromotionSummary>[]>(
    () => [
      {
        id: 'code',
        header: 'Code',
        cell: (row) => <span className="font-mono text-xs font-medium">{row.code}</span>,
      },
      {
        id: 'title',
        header: 'Title',
        cell: (row) => row.title,
      },
      {
        id: 'type',
        header: 'Type',
        cell: (row) => <Badge tone="neutral">{row.promotionType}</Badge>,
      },
      {
        id: 'active',
        header: 'Active',
        cell: (row) => (
          <Badge tone={row.active ? 'success' : 'danger'}>{row.active ? 'Yes' : 'No'}</Badge>
        ),
      },
      {
        id: 'bonus',
        header: 'Bonus',
        cell: (row) =>
          row.bonusAmount != null
            ? `${formatDecimal(row.bonusAmount)} ${row.bonusCurrencyCode ?? ''}`.trim()
            : '—',
      },
      {
        id: 'window',
        header: 'Window',
        cell: (row) => (
          <span className="text-xs text-text-secondary">
            {formatDateTime(row.startsAt)} → {formatDateTime(row.endsAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: (row) => (
          <div className="flex flex-wrap gap-2">
            {canWrite ? (
              <Button variant="secondary" size="sm" onClick={() => beginEdit(row)}>
                Edit
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={() => void loadCampaignConfig(row.id)}>
              Configure
            </Button>
          </div>
        ),
      },
    ],
    [canWrite],
  );

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BadgePercent className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Promotions</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              View active promotions and create new ones.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="mb-4 text-base font-semibold text-text-primary">Active promotions</h3>
        {listQuery.isLoading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : listQuery.isError ? (
          <ErrorState
            description={
              listQuery.error instanceof ApiClientError
                ? listQuery.error.message
                : 'Failed to load promotions.'
            }
            onRetry={() => void listQuery.refetch()}
          />
        ) : (listQuery.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No active promotions"
            description="Create a promotion below to get started."
          />
        ) : (
          <DataTable
            columns={columns}
            rows={listQuery.data ?? []}
            rowKey={(row) => row.id}
          />
        )}

        {editingId && canWrite ? (
          <div className="mt-5 rounded-[0.6rem] border border-border bg-surface-secondary/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">Edit active promotion</h4>
                <p className="mt-1 text-sm text-text-secondary">
                  Update details for{' '}
                  <span className="font-mono text-xs">{editCode || editingId}</span>. Deactivating
                  hides it from the active list.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input
                label="Code"
                value={editCode}
                onChange={(event) => setEditCode(event.target.value.toUpperCase())}
                error={editErrors.code}
              />
              <Input
                label="Title"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                error={editErrors.title}
              />
              <Select
                label="Type"
                value={editPromotionType}
                onChange={(event) => setEditPromotionType(event.target.value as PromotionType)}
              >
                {PROMOTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
              <Select
                label="Active"
                value={editActive ? 'true' : 'false'}
                onChange={(event) => setEditActive(event.target.value === 'true')}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>
              <Input
                label="Description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                error={editErrors.description}
              />
              <div />
              <Input
                label="Starts at"
                type="datetime-local"
                value={editStartsAt}
                onChange={(event) => setEditStartsAt(event.target.value)}
              />
              <Input
                label="Ends at"
                type="datetime-local"
                value={editEndsAt}
                onChange={(event) => setEditEndsAt(event.target.value)}
              />
              <Input
                label="Bonus amount"
                value={editBonusAmount}
                onChange={(event) => setEditBonusAmount(event.target.value)}
                inputMode="decimal"
                placeholder="Optional"
              />
              <div className="space-y-1.5">
                <Select
                  label="Bonus currency"
                  multiple
                  value={editBonusCurrencies}
                  onChange={(event) => {
                    const selected = Array.from(event.target.selectedOptions).map(
                      (option) => option.value,
                    );
                    setEditBonusCurrencies(selected);
                  }}
                  error={editErrors.bonusCurrencyCode}
                  className="min-h-[7.5rem] py-2"
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code}
                      {currency.symbol ? ` (${currency.symbol})` : ''}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-text-muted">
                  Hold Ctrl/Cmd to select multiple. Selected:{' '}
                  {editBonusCurrencies.length > 0 ? editBonusCurrencies.join(', ') : 'none'}
                </p>
              </div>
              {editPromotionType === 'REFERRAL' ? (
                <label className="md:col-span-2 flex items-start gap-3 rounded-[0.6rem] border border-border bg-surface p-3 text-sm text-text-primary">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={editReferrerRequiresInviteeTrade}
                    onChange={(event) => setEditReferrerRequiresInviteeTrade(event.target.checked)}
                  />
                  <span>
                    <span className="font-medium">Require invitee InstantEx or P2P before inviter bonus</span>
                    <span className="mt-1 block text-xs text-text-secondary">
                      The person who invites only receives their referral bonus after the invitee
                      completes an InstantEx or P2P trade. The invitee still gets their bonus when
                      the code is applied.
                    </span>
                  </span>
                </label>
              ) : null}
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <Button onClick={() => setEditConfirmOpen(true)}>Review & save</Button>
                <Button variant="secondary" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">Create promotion</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Bonus amounts are saved exactly as entered.
        </p>
        {!canWrite ? (
          <div className="mt-4">
            <ErrorState
              title="Permission required"
              description="promotions:write is required to create promotions."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input
              label="Code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              error={errors.code}
              placeholder="SUMMER25"
            />
            <Input
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              error={errors.title}
            />
            <Select
              label="Type"
              value={promotionType}
              onChange={(event) => setPromotionType(event.target.value as PromotionType)}
            >
              {PROMOTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
            <Input
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              error={errors.description}
            />
            <Input
              label="Starts at"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
            <Input
              label="Ends at"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
            <Input
              label="Bonus amount"
              value={bonusAmount}
              onChange={(event) => setBonusAmount(event.target.value)}
              inputMode="decimal"
              placeholder="Optional"
            />
            <div className="space-y-1.5">
              <Select
                label="Bonus currency"
                multiple
                value={bonusCurrencies}
                onChange={(event) => {
                  const selected = Array.from(event.target.selectedOptions).map(
                    (option) => option.value,
                  );
                  setBonusCurrencies(selected);
                }}
                error={errors.bonusCurrencyCode}
                className="min-h-[7.5rem] py-2"
              >
                {currencyOptions.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code}
                    {currency.symbol ? ` (${currency.symbol})` : ''}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-text-muted">
                Hold Ctrl/Cmd to select multiple. Selected:{' '}
                {bonusCurrencies.length > 0 ? bonusCurrencies.join(', ') : 'none'}
              </p>
            </div>
            {promotionType === 'REFERRAL' ? (
              <label className="md:col-span-2 flex items-start gap-3 rounded-[0.6rem] border border-border bg-surface-secondary/40 p-3 text-sm text-text-primary">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={referrerRequiresInviteeTrade}
                  onChange={(event) => setReferrerRequiresInviteeTrade(event.target.checked)}
                />
                <span>
                  <span className="font-medium">Require invitee InstantEx or P2P before inviter bonus</span>
                  <span className="mt-1 block text-xs text-text-secondary">
                    The person who invites only receives their referral bonus after the invitee
                    completes an InstantEx or P2P trade. The invitee still gets their bonus when the
                    code is applied.
                  </span>
                </span>
              </label>
            ) : null}
            <div className="md:col-span-2">
              <Button onClick={() => setConfirmOpen(true)}>Review & create</Button>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-semibold text-text-primary">Referral inventory</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Cross-user referral codes and pending bonuses are available in the Referrals module.
          </p>
          <Link
            to="/admin/referrals"
            className="mt-3 inline-flex text-sm text-primary hover:underline"
          >
            Open Referrals →
          </Link>
        </section>
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-semibold text-text-primary">Campaign formula & eligibility</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Configure how bonuses are calculated and who qualifies when a referral promotion applies.
          </p>
          {!canWrite ? (
            <p className="mt-3 text-sm text-text-muted">promotions:write required.</p>
          ) : (
            <div className="mt-4 space-y-3">
              <Select
                label="Promotion"
                value={campaignPromotionId}
                onChange={(event) => void loadCampaignConfig(event.target.value)}
              >
                <option value="">Select a promotion…</option>
                {(listQuery.data ?? []).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.code} — {row.title}
                  </option>
                ))}
              </Select>
              <div className="grid gap-3 md:grid-cols-2">
                <Select
                  label="Formula type"
                  value={formulaType}
                  onChange={(event) =>
                    setFormulaType(event.target.value as PromotionFormula['type'])
                  }
                >
                  <option value="FLAT">FLAT</option>
                  <option value="PERCENT">PERCENT</option>
                </Select>
                <Input
                  label="Formula value"
                  value={formulaValue}
                  onChange={(event) => setFormulaValue(event.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 10 or 5 for 5%"
                />
                <Input
                  label="Min KYC level (0–3)"
                  value={minKycLevel}
                  onChange={(event) => setMinKycLevel(event.target.value)}
                  inputMode="numeric"
                />
                <Input
                  label="Min completed P2P orders"
                  value={minCompletedOrders}
                  onChange={(event) => setMinCompletedOrders(event.target.value)}
                  inputMode="numeric"
                />
                <Input
                  label="Countries (CSV, ISO-2)"
                  value={countriesCsv}
                  onChange={(event) => setCountriesCsv(event.target.value.toUpperCase())}
                  placeholder="NG,CA"
                />
              </div>
              <label className="flex items-start gap-3 rounded-[0.6rem] border border-border bg-surface-secondary/40 p-3 text-sm text-text-primary">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={campaignReferrerRequiresInviteeTrade}
                  onChange={(event) =>
                    setCampaignReferrerRequiresInviteeTrade(event.target.checked)
                  }
                />
                <span>
                  <span className="font-medium">
                    Require invitee InstantEx or P2P before inviter bonus
                  </span>
                  <span className="mt-1 block text-xs text-text-secondary">
                    Applies to referral promotions: unlock the inviter bonus only after the invitee
                    completes InstantEx or P2P.
                  </span>
                </span>
              </label>
              <Button
                disabled={!campaignPromotionId || campaignBusy}
                onClick={() => void saveCampaignConfig()}
              >
                Save campaign rules
              </Button>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Create promotion"
        description={`Create ${code || '—'} (${promotionType}) titled “${title || '—'}”?`}
        confirmLabel="Create promotion"
        tone="primary"
        busy={createMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => createMutation.mutate()}
      />
      <ConfirmDialog
        open={editConfirmOpen}
        title="Save promotion changes?"
        description={`Update ${editCode || '—'} (${editPromotionType}) titled “${editTitle || '—'}”? Active: ${editActive ? 'Yes' : 'No'}.`}
        confirmLabel="Save changes"
        tone="primary"
        busy={updateMutation.isPending}
        onClose={() => setEditConfirmOpen(false)}
        onConfirm={() => updateMutation.mutate()}
      />
    </div>
  );
}

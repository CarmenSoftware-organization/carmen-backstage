import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Loader2, ScrollText, SlidersHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { DataTable } from '../../components/ui/data-table';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { EmptyState } from '../../components/EmptyState';
import Can from '../../components/Can';
import { useI18n } from '../../hooks/useI18n';
import { cn } from '../../lib/utils';
import aiCreditService from '../../services/aiCreditService';
import { generateCSV, downloadCSV } from '../../utils/csvExport';
import { getErrorDetail } from '../../utils/errorParser';
import { isVersionConflict, notifyVersionConflict } from '../../utils/docVersion';
import { readStoredPerpage } from '../../utils/pageRange';
import { fmtPct, meterWidth } from '../../utils/storageQuota';
import { LicenseSectionHeader } from './LicenseSectionHeader';
import type { AiCreditBalance, AiCreditLedgerEntry, AiCreditLicense } from '../../types';
import type { TKey } from '../../i18n/types';

interface BusinessUnitAiCreditCardProps {
  buId: string;
}

const PERPAGE_KEY = 'perpage_ai_credit_ledger';
const DEFAULT_PERPAGE = 10;
/** ledger รับ perpage 1-100 — ส่งออก CSV ดึงทีละ 100 หน้าสูงสุดเท่านี้เพื่อไม่ให้วนไม่จบ */
const EXPORT_PERPAGE = 100;
const EXPORT_MAX_PAGES = 20;
const ALL = 'all';

const ENTRY_TYPES = ['debit', 'topup', 'topup_void', 'adjust'] as const;
const FEATURES = ['ocr_grn_po_match', 'ocr_ap_invoice', 'ocr_payment_reconcile'] as const;

const TYPE_KEY: Record<string, TKey> = {
  debit: 'pages.aiCredit.type.debit',
  topup: 'pages.aiCredit.type.topup',
  topup_void: 'pages.aiCredit.type.topup_void',
  adjust: 'pages.aiCredit.type.adjust',
};
const POOL_KEY: Record<string, TKey> = {
  monthly: 'pages.aiCredit.pool.monthly',
  topup: 'pages.aiCredit.pool.topup',
};
const FEATURE_KEY: Record<string, TKey> = {
  ocr_grn_po_match: 'pages.aiCredit.feature.ocr_grn_po_match',
  ocr_ap_invoice: 'pages.aiCredit.feature.ocr_ap_invoice',
  ocr_payment_reconcile: 'pages.aiCredit.feature.ocr_payment_reconcile',
};

const fmtNum = (n: number) => n.toLocaleString();
const fmtSigned = (n: number) => (n > 0 ? `+${fmtNum(n)}` : fmtNum(n));
const isInt = (s: string) => /^-?\d+$/.test(s.trim());

interface Filters {
  type: string;
  feature: string;
  month: string;
}
const NO_FILTERS: Filters = { type: ALL, feature: ALL, month: '' };

const toFilterParam = (f: Filters): Record<string, string> => {
  const out: Record<string, string> = {};
  if (f.type !== ALL) out.entry_type = f.type;
  if (f.feature !== ALL) out.feature = f.feature;
  if (/^\d{4}-\d{2}$/.test(f.month)) out.month = f.month;
  return out;
};

/**
 * การ์ด AI credit ของ BU — ยอดคงเหลือ (โควตารายเดือน + top-up), ใบ top-up `AIC-` และ ledger แบบ append-only
 * อ่านได้ตามขอบเขตที่ backend ตรวจ · ออกใบ/ปรับยอด/ยกเลิกใบต้องมี `subscription.manage`
 * ตัวเลขใหญ่กับแถบวัดปริมาณเดียวกัน (ใช้ไป / โควตารายเดือน) · top-up ติดลบได้ แสดงค่าดิบเป็นสีแดง
 */
export default function BusinessUnitAiCreditCard({ buId }: BusinessUnitAiCreditCardProps) {
  const { t } = useI18n();

  const [balance, setBalance] = useState<AiCreditBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState('');
  const [licenses, setLicenses] = useState<AiCreditLicense[]>([]);
  const [licensesLoading, setLicensesLoading] = useState(true);

  const [rows, setRows] = useState<AiCreditLedgerEntry[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerError, setLedgerError] = useState('');
  const [page, setPage] = useState(1);
  const [perpage, setPerpage] = useState(() => readStoredPerpage(PERPAGE_KEY, DEFAULT_PERPAGE));
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [exporting, setExporting] = useState(false);

  const [issueOpen, setIssueOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<AiCreditLicense | null>(null);

  // ตัวนับรุ่นของแต่ละ fetch — คำตอบเก่าที่มาถึงทีหลังต้องถูกทิ้งทุกสาขา (then/catch/finally)
  const balanceGen = useRef(0);
  const licensesGen = useRef(0);
  const ledgerGen = useRef(0);

  const loadBalance = useCallback(async () => {
    const gen = ++balanceGen.current;
    setBalanceLoading(true);
    setBalanceError('');
    try {
      const next = await aiCreditService.balance(buId);
      if (gen !== balanceGen.current) return;
      setBalance(next);
    } catch (err: unknown) {
      if (gen !== balanceGen.current) return;
      setBalanceError(getErrorDetail(err, t));
    } finally {
      if (gen === balanceGen.current) setBalanceLoading(false);
    }
  }, [buId, t]);

  const loadLicenses = useCallback(async () => {
    const gen = ++licensesGen.current;
    setLicensesLoading(true);
    try {
      const next = await aiCreditService.licenses(buId);
      if (gen !== licensesGen.current) return;
      setLicenses(next);
    } catch (err: unknown) {
      if (gen !== licensesGen.current) return;
      toast.error(getErrorDetail(err, t));
    } finally {
      if (gen === licensesGen.current) setLicensesLoading(false);
    }
  }, [buId, t]);

  const loadLedger = useCallback(async () => {
    const gen = ++ledgerGen.current;
    setLedgerLoading(true);
    setLedgerError('');
    try {
      const res = await aiCreditService.ledger(buId, { page, perpage, filter: toFilterParam(filters) });
      if (gen !== ledgerGen.current) return;
      setRows(res.data ?? []);
      setTotalRows(res.paginate?.total ?? 0);
    } catch (err: unknown) {
      if (gen !== ledgerGen.current) return;
      setLedgerError(getErrorDetail(err, t));
    } finally {
      if (gen === ledgerGen.current) setLedgerLoading(false);
    }
  }, [buId, page, perpage, filters, t]);

  useEffect(() => {
    void loadBalance();
    void loadLicenses();
  }, [loadBalance, loadLicenses]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  /** หลังเขียน: ยอด + ใบ + ledger เปลี่ยนพร้อมกัน — ledger กลับหน้า 1 เพราะแถวใหม่อยู่บนสุด */
  const refreshAll = useCallback(() => {
    void loadBalance();
    void loadLicenses();
    if (page === 1) void loadLedger();
    else setPage(1);
  }, [loadBalance, loadLicenses, loadLedger, page]);

  const handleVoid = async () => {
    const target = voidTarget;
    if (!target) return;
    try {
      await aiCreditService.voidLicense(buId, target.id, target.doc_version);
      toast.success(t('pages.aiCredit.voided', { number: target.license_number }));
      setVoidTarget(null);
      refreshAll();
    } catch (err: unknown) {
      setVoidTarget(null);
      if (isVersionConflict(err)) {
        notifyVersionConflict(t);
        void loadLicenses();
        return;
      }
      toast.error(getErrorDetail(err, t));
    }
  };

  const setFilter = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const filtersActive = filters.type !== ALL || filters.feature !== ALL || filters.month !== '';

  const handleExport = async () => {
    try {
      setExporting(true);
      const filter = toFilterParam(filters);
      const all: AiCreditLedgerEntry[] = [];
      let truncated = false;
      for (let p = 1; p <= EXPORT_MAX_PAGES; p++) {
        const res = await aiCreditService.ledger(buId, { page: p, perpage: EXPORT_PERPAGE, filter });
        all.push(...(res.data ?? []));
        if (p >= (res.paginate?.pages ?? 1)) break;
        if (p === EXPORT_MAX_PAGES) truncated = true;
      }
      const csv = generateCSV(
        all.map((r) => ({
          created_at: r.created_at ?? '',
          entry_type: r.entry_type,
          pool: r.pool,
          feature: r.feature ?? '',
          credits: r.credits,
          month: r.month,
          license_number: r.license_number ?? '',
          note: r.reason ?? r.note ?? '',
        })),
        [
          { key: 'created_at', label: t('pages.aiCredit.colDate') },
          { key: 'entry_type', label: t('pages.aiCredit.colType') },
          { key: 'pool', label: t('pages.aiCredit.colPool') },
          { key: 'feature', label: t('pages.aiCredit.colFeature') },
          { key: 'credits', label: t('pages.aiCredit.colAmount') },
          { key: 'month', label: t('pages.aiCredit.colMonth') },
          { key: 'license_number', label: t('pages.aiCredit.colLicense') },
          { key: 'note', label: t('pages.aiCredit.colDetail') },
        ],
      );
      downloadCSV(csv, `ai-credit-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
      if (truncated) toast.warning(t('pages.aiCredit.exportTruncated', { count: all.length }));
      else toast.success(t('pages.aiCredit.exported', { count: all.length }));
    } catch (err: unknown) {
      toast.error(getErrorDetail(err, t));
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo<ColumnDef<AiCreditLedgerEntry, unknown>[]>(
    () => [
      {
        id: 'created_at',
        header: t('pages.aiCredit.colDate'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.created_at ? (
            <span className="whitespace-nowrap">{new Date(row.original.created_at).toLocaleString()}</span>
          ) : (
            '-'
          ),
        meta: { card: 'title' },
      },
      {
        id: 'entry_type',
        header: t('pages.aiCredit.colType'),
        enableSorting: false,
        cell: ({ row }) => {
          const type = row.original.entry_type;
          const key = TYPE_KEY[type];
          return <Badge variant={type === 'debit' ? 'secondary' : 'outline'}>{key ? t(key) : type}</Badge>;
        },
        meta: { card: 'badge' },
      },
      {
        id: 'pool',
        header: t('pages.aiCredit.colPool'),
        enableSorting: false,
        cell: ({ row }) => {
          const key = POOL_KEY[row.original.pool];
          return key ? t(key) : row.original.pool;
        },
      },
      {
        id: 'feature',
        header: t('pages.aiCredit.colFeature'),
        enableSorting: false,
        cell: ({ row }) => {
          const f = row.original.feature;
          if (!f) return '-';
          const key = FEATURE_KEY[f];
          return key ? t(key) : f;
        },
      },
      {
        id: 'credits',
        header: t('pages.aiCredit.colAmount'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className={cn('font-mono tabular-nums', row.original.credits < 0 && 'text-destructive')}>
            {fmtSigned(row.original.credits)}
          </span>
        ),
      },
      {
        id: 'month',
        header: t('pages.aiCredit.colMonth'),
        enableSorting: false,
        cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.month}</span>,
      },
      {
        id: 'detail',
        header: t('pages.aiCredit.colDetail'),
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          const text = [r.license_number, r.reason ?? r.note].filter(Boolean).join(' · ');
          return text ? <span className="break-words">{text}</span> : '-';
        },
      },
    ],
    [t],
  );

  const quota = balance?.monthly_quota ?? 0;
  const used = balance?.monthly_used ?? 0;
  const usedPctRaw = quota > 0 ? (used / quota) * 100 : 0;
  const over = quota > 0 && used >= quota;
  const near = usedPctRaw >= 80;
  const topup = balance?.topup_remaining ?? 0;

  return (
    <Card>
      <LicenseSectionHeader
        title={t('pages.aiCredit.cardTitle')}
        facts={balance?.month ? t('pages.aiCredit.facts', { month: balance.month }) : balanceLoading ? t('common.busy.loadingEllipsis') : null}
        actions={
          <Can permission="subscription.manage">
            <Button variant="outline" size="sm" disabled={!balance} onClick={() => setAdjustOpen(true)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              {t('pages.aiCredit.adjust')}
            </Button>
            <Button size="sm" disabled={!balance} onClick={() => setIssueOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('pages.aiCredit.issueTopup')}
            </Button>
          </Can>
        }
      />
      <CardContent className="space-y-6">
        {balanceError ? (
          <p className="text-destructive text-sm" role="alert">{balanceError}</p>
        ) : balance ? (
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{t('pages.aiCredit.monthlyUsed')}</span>
                {balance.low && <Badge variant="warning">{t('pages.aiCredit.low')}</Badge>}
              </div>
              {quota > 0 ? (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-2 font-mono tabular-nums">
                    <span className={cn('text-base font-semibold', over && 'text-destructive')}>{fmtNum(used)}</span>
                    <span className="text-muted-foreground text-sm">/ {fmtNum(quota)}</span>
                    <span className={cn('text-sm', over ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
                      {fmtPct(usedPctRaw)}
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden="true">
                    <div
                      className={cn('h-full', over ? 'bg-destructive' : near ? 'bg-warning' : 'bg-primary')}
                      style={{ width: meterWidth(usedPctRaw) }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">{t('pages.aiCredit.noMonthlyQuota')}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">{t('pages.aiCredit.topupRemaining')}</span>
              <div className={cn('font-mono text-base font-semibold tabular-nums', topup < 0 && 'text-destructive')}>
                {fmtNum(topup)}
              </div>
              <p className="text-muted-foreground text-xs">{t('pages.aiCredit.topupHint')}</p>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">{t('pages.aiCredit.available')}</span>
              <div className="font-mono text-base font-semibold tabular-nums">{fmtNum(balance.available)}</div>
              {!!balance.pending && balance.pending > 0 && (
                <p className="text-muted-foreground text-xs">{t('pages.aiCredit.pending', { count: fmtNum(balance.pending) })}</p>
              )}
            </div>
          </div>
        ) : null}

        <section className="space-y-2">
          <h4 className="text-sm font-medium">{t('pages.aiCredit.licensesTitle')}</h4>
          {licensesLoading && licenses.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t('common.busy.loadingEllipsis')}</p>
          ) : licenses.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('pages.aiCredit.noLicenses')}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {licenses.map((l) => {
                const voided = !!l.deleted_at;
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
                    <span className={cn('font-mono', voided && 'text-muted-foreground line-through')}>{l.license_number}</span>
                    <span className={cn('font-mono tabular-nums', voided && 'text-muted-foreground')}>
                      {fmtSigned(l.credits)}
                    </span>
                    <Badge variant={voided ? 'secondary' : 'success'}>
                      {voided ? t('pages.aiCredit.statusVoided') : t('pages.aiCredit.statusActive')}
                    </Badge>
                    <span className="text-muted-foreground min-w-0 flex-1 break-words text-xs">
                      {[l.reference_no, l.created_at ? new Date(l.created_at).toLocaleDateString() : null, l.note]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {!voided && (
                      <Can permission="subscription.manage">
                        <Button variant="outline" size="sm" onClick={() => setVoidTarget(l)}>
                          {t('pages.aiCredit.void')}
                        </Button>
                      </Can>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h4 className="text-sm font-medium">{t('pages.aiCredit.ledgerTitle')}</h4>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || totalRows === 0}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {t('pages.aiCredit.exportCsv')}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor={`ai-credit-type-${buId}`}>{t('pages.aiCredit.filterType')}</Label>
              <Select value={filters.type} onValueChange={(v) => setFilter({ type: v })}>
                <SelectTrigger id={`ai-credit-type-${buId}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('pages.aiCredit.allTypes')}</SelectItem>
                  {ENTRY_TYPES.map((v) => (
                    <SelectItem key={v} value={v}>{t(TYPE_KEY[v])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ai-credit-feature-${buId}`}>{t('pages.aiCredit.filterFeature')}</Label>
              <Select value={filters.feature} onValueChange={(v) => setFilter({ feature: v })}>
                <SelectTrigger id={`ai-credit-feature-${buId}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('pages.aiCredit.allFeatures')}</SelectItem>
                  {FEATURES.map((v) => (
                    <SelectItem key={v} value={v}>{t(FEATURE_KEY[v])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ai-credit-month-${buId}`}>{t('pages.aiCredit.filterMonth')}</Label>
              <Input
                id={`ai-credit-month-${buId}`}
                type="month"
                value={filters.month}
                onChange={(e) => setFilter({ month: e.target.value })}
              />
            </div>
            {filtersActive && (
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={() => { setFilters(NO_FILTERS); setPage(1); }}>
                  {t('pages.aiCredit.clearFilters')}
                </Button>
              </div>
            )}
          </div>
          {ledgerError ? (
            <p className="text-destructive text-sm" role="alert">{ledgerError}</p>
          ) : !ledgerLoading && rows.length === 0 ? (
            <EmptyState icon={ScrollText} title={t('pages.aiCredit.noLedger')} />
          ) : (
            <div className={cn(ledgerLoading && 'opacity-60')}>
              <DataTable
                columns={columns}
                data={rows}
                serverSide
                totalRows={totalRows}
                page={page}
                perpage={perpage}
                onPaginateChange={({ page: p, perpage: pp }) => {
                  if (pp !== perpage) localStorage.setItem(PERPAGE_KEY, String(pp));
                  setPerpage(pp);
                  setPage(p);
                }}
                getRowId={(r) => r.id}
              />
            </div>
          )}
        </section>
      </CardContent>

      <IssueDialog open={issueOpen} onOpenChange={setIssueOpen} buId={buId} onDone={refreshAll} />
      <AdjustDialog open={adjustOpen} onOpenChange={setAdjustOpen} buId={buId} onDone={refreshAll} />
      <ConfirmDialog
        open={!!voidTarget}
        onOpenChange={(o) => { if (!o) setVoidTarget(null); }}
        title={t('pages.aiCredit.voidTitle', { number: voidTarget?.license_number ?? '' })}
        description={t('pages.aiCredit.voidDescription', { credits: fmtNum(voidTarget?.credits ?? 0) })}
        confirmText={t('pages.aiCredit.voidConfirm')}
        confirmVariant="destructive"
        onConfirm={handleVoid}
      />
    </Card>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buId: string;
  onDone: () => void;
}

function IssueDialog({ open, onOpenChange, buId, onDone }: DialogProps) {
  const { t } = useI18n();
  const [credits, setCredits] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCredits('');
      setReference('');
      setNote('');
      setTouched(false);
    }
  }, [open]);

  const valid = isInt(credits) && Number(credits) >= 1 && Number(credits) <= 2147483647;

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    try {
      setSaving(true);
      const issued = await aiCreditService.createLicense(buId, {
        credits: Number(credits),
        reference_no: reference.trim() || null,
        note: note.trim() || null,
      });
      toast.success(t('pages.aiCredit.issued', { number: issued.license_number }));
      onOpenChange(false);
      onDone();
    } catch (err: unknown) {
      toast.error(getErrorDetail(err, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.aiCredit.issueTitle')}</DialogTitle>
          <DialogDescription>{t('pages.aiCredit.issueDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-credit-issue-credits">{t('pages.aiCredit.creditsLabel')}</Label>
            <Input
              id="ai-credit-issue-credits"
              inputMode="numeric"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && !valid}
            />
            {touched && !valid && <p className="text-destructive text-xs" role="alert">{t('pages.aiCredit.creditsError')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-credit-issue-ref">{t('pages.aiCredit.referenceLabel')}</Label>
            <Input id="ai-credit-issue-ref" maxLength={200} value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-credit-issue-note">{t('pages.aiCredit.noteLabel')}</Label>
            <Textarea id="ai-credit-issue-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('pages.aiCredit.issue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ open, onOpenChange, buId, onDone }: DialogProps) {
  const { t } = useI18n();
  const [credits, setCredits] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCredits('');
      setReason('');
      setTouched(false);
    }
  }, [open]);

  const n = Number(credits);
  const creditsValid = isInt(credits) && n !== 0 && Math.abs(n) <= 2147483647;
  const reasonValid = reason.trim().length >= 1 && reason.trim().length <= 500;

  const submit = async () => {
    setTouched(true);
    if (!creditsValid || !reasonValid) return;
    try {
      setSaving(true);
      await aiCreditService.adjust(buId, { credits: n, reason: reason.trim() });
      toast.success(t('pages.aiCredit.adjusted'));
      onOpenChange(false);
      onDone();
    } catch (err: unknown) {
      toast.error(getErrorDetail(err, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.aiCredit.adjustTitle')}</DialogTitle>
          <DialogDescription>{t('pages.aiCredit.adjustDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-credit-adjust-credits">{t('pages.aiCredit.adjustCreditsLabel')}</Label>
            <Input
              id="ai-credit-adjust-credits"
              inputMode="numeric"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && !creditsValid}
            />
            {touched && !creditsValid && <p className="text-destructive text-xs" role="alert">{t('pages.aiCredit.adjustCreditsError')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-credit-adjust-reason">{t('pages.aiCredit.reasonLabel')}</Label>
            <Textarea
              id="ai-credit-adjust-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && !reasonValid}
            />
            {touched && !reasonValid && <p className="text-destructive text-xs" role="alert">{t('pages.aiCredit.reasonRequired')}</p>}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('pages.aiCredit.adjustSave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

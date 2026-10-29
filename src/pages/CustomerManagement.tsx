import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useGlobalShortcuts } from '../components/KeyboardShortcuts';
import { useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import customerService from '../services/customerService';
import { getErrorDetail, devLog, parseApiError } from '../utils/errorParser';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { DataTable } from '../components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Plus, Pencil, Trash2, MoreHorizontal, Receipt, Download } from 'lucide-react';
import { toast } from 'sonner';
import { SearchInput } from '../components/SearchInput';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { ListEmptyState } from '../components/ListEmptyState';
import { generateCSV, downloadCSV } from '../utils/csvExport';
import { TableSkeleton } from '../components/TableSkeleton';
import { DevDebugSheet } from '../components/ui/dev-debug-sheet';
import Can from '../components/Can';
import { auditColumns } from '../components/auditColumns';
import { useI18n } from '../hooks/useI18n';
import { normalizeAudit, auditCsvFields } from '../utils/audit';
import { LicenseSummaryBand, type SummaryBandItem } from './licenses/LicenseSummaryBand';
import { customerErrorKind } from './customerEdit/customerErrors';
import { readStoredPerpage } from '../utils/pageRange';
import type { Customer, CustomerSummary, CustomerStatus, PaginateParams } from '../types';
import type { ColumnDef } from '@tanstack/react-table';

type StatusFilter = CustomerStatus | 'all';

const isStatusFilter = (v: string | null): v is StatusFilter => v === 'all' || v === 'active' || v === 'inactive';

const buildAdvance = (status: StatusFilter) =>
  status === 'all' ? '' : JSON.stringify({ where: { status } });

const CustomerManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [items, setItems] = useState<Customer[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<CustomerSummary | undefined>(undefined);
  const [rawResponse, setRawResponse] = useState<unknown>(null);

  const storedSearch = localStorage.getItem('search_customers') || '';
  const storedStatusRaw = localStorage.getItem('status_customers');
  const storedStatus: StatusFilter = isStatusFilter(storedStatusRaw) ? storedStatusRaw : 'all';
  const storedPage = Number(localStorage.getItem('page_customers')) || 1;
  const storedSort = localStorage.getItem('sort_customers') || 'created_at:desc';

  const [searchTerm, setSearchTerm] = useState(storedSearch);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(storedStatus);
  const [paginate, setPaginate] = useState<PaginateParams>({
    page: storedPage,
    perpage: readStoredPerpage('perpage_customer', 10),
    search: storedSearch,
    sort: storedSort,
    advance: buildAdvance(storedStatus),
    filter: {},
  });

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useGlobalShortcuts({ onSearch: () => searchInputRef.current?.focus() });

  const fetchCustomers = useCallback(async (params: PaginateParams = paginate) => {
    try {
      setLoading(true);
      const data = await customerService.getAll(params);
      setRawResponse(data);
      const list = data.data ?? [];
      setItems(list);
      setTotalRows(data.paginate?.total ?? data.total ?? list.length);
      // summary ครอบทั้งทะเบียน ไม่ตามตัวกรองของคำขอ · ไม่มา = backend คำนวณล้ม คงค่าเดิมไว้
      if (data.summary) setSummary(data.summary);
      setError('');
    } catch (err: unknown) {
      setError(t('pages.customers.loadFailed', { detail: getErrorDetail(err, t) }));
      devLog('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  }, [paginate, t]);

  useEffect(() => {
    fetchCustomers(paginate);
  }, [fetchCustomers, paginate]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    localStorage.setItem('search_customers', value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      localStorage.setItem('page_customers', '1');
      setPaginate(prev => ({ ...prev, page: 1, search: value }));
    }, 400);
  };

  const handlePaginateChange = ({ page, perpage }: { page: number; perpage: number }) => {
    localStorage.setItem('perpage_customer', String(perpage));
    localStorage.setItem('page_customers', String(page));
    setPaginate(prev => ({ ...prev, page, perpage }));
  };

  const handleStatusFilter = (status: StatusFilter) => {
    setStatusFilter(status);
    localStorage.setItem('status_customers', status);
    localStorage.setItem('page_customers', '1');
    setPaginate(prev => ({ ...prev, page: 1, advance: buildAdvance(status), filter: {} }));
  };

  const handleSortChange = (sort: string) => {
    localStorage.setItem('sort_customers', sort);
    localStorage.setItem('page_customers', '1');
    setPaginate(prev => ({ ...prev, sort, page: 1 }));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await customerService.delete(deleteTarget.id);
      toast.success(t('pages.customers.deletedToast', { name: deleteTarget.company_name || deleteTarget.ar_number }));
      setDeleteTarget(null);
      fetchCustomers();
    } catch (err) {
      // 409 BACKSTAGE_CUSTOMER_IN_USE — บอกจำนวน BU ที่บล็อกอยู่จากแถวที่กด (bu_count) ส่วนข้อความ
      // อื่นใช้ของ backend ตรง ๆ เพราะ getErrorDetail จะตัดเหลือ "ลองใหม่ภายหลัง" ใน production
      if (customerErrorKind(err) === 'in_use') {
        const count = deleteTarget.bu_count;
        toast.error(count ? t('pages.customers.inUse', { count }) : t('pages.customers.inUseGeneric'));
        setDeleteTarget(null);
        fetchCustomers();
      } else {
        toast.error(parseApiError(err, t).message);
      }
      devLog('deleteCustomer', err);
    }
  };

  const handleExport = () => {
    const rows = items.map((item) => ({ ...item, ...auditCsvFields(normalizeAudit(item)) }));
    const csv = generateCSV(rows, [
      { key: 'ar_number', label: t('pages.customers.columnArNumber') },
      { key: 'company_name', label: t('pages.customers.columnCompany') },
      { key: 'tax_no', label: t('pages.customers.columnTaxNo') },
      { key: 'status', label: t('common.status.label') },
      { key: 'bu_count', label: t('pages.customers.columnBuCount') },
      { key: 'note', label: t('pages.customers.columnNote') },
      { key: 'created_at', label: t('common.audit.createdAt') },
      { key: 'created_by', label: t('common.audit.createdBy') },
      { key: 'updated_at', label: t('common.audit.updatedAt') },
      { key: 'updated_by', label: t('common.audit.updatedBy') },
    ]);
    downloadCSV(csv, `customers-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(t('toast.exported'));
  };

  const columns = useMemo<ColumnDef<Customer, unknown>[]>(() => [
    {
      accessorKey: 'ar_number',
      header: t('pages.customers.columnArNumber'),
      meta: { card: 'title' },
      cell: ({ row }) => (
        <Link
          to={`/customers/${row.original.id}/edit`}
          className="font-mono text-[13px] font-medium hover:underline"
        >
          {row.original.ar_number}
        </Link>
      ),
    },
    {
      accessorKey: 'company_name',
      header: t('pages.customers.columnCompany'),
      cell: ({ row }) => row.original.company_name || <span className="text-muted-foreground">-</span>,
    },
    {
      accessorKey: 'tax_no',
      header: t('pages.customers.columnTaxNo'),
      cell: ({ row }) => row.original.tax_no
        ? <span className="font-mono text-xs">{row.original.tax_no}</span>
        : <span className="text-muted-foreground">-</span>,
    },
    {
      accessorKey: 'status',
      header: t('common.status.label'),
      meta: { card: 'badge' },
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'active' ? 'success' : 'secondary'}>
          {row.original.status === 'active' ? t('common.status.active') : t('common.status.inactive')}
        </Badge>
      ),
    },
    {
      // bu_count ไม่ใช่คอลัมน์ในตาราง (คำนวณจาก groupBy) — เรียงฝั่ง server ไม่ได้
      id: 'bu_count',
      accessorFn: (row: Customer) => row.bu_count ?? 0,
      header: t('pages.customers.columnBuCount'),
      enableSorting: false,
      cell: ({ row }) => <span className="tabular-nums">{row.original.bu_count ?? 0}</span>,
    },
    ...auditColumns<Customer>({ t }),
    {
      id: 'actions',
      header: '',
      meta: { headerClassName: 'w-10', cellClassName: 'text-center p-0' },
      cell: ({ row }) => (
        <Can permission="customer.manage">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('pages.customers.actionsAria')}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/customers/${row.original.id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('common.action.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteTarget(row.original)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('common.action.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Can>
      ),
    },
  ], [navigate, t]);

  const bandItems: SummaryBandItem[] = [
    { key: 'all', label: t('pages.customers.summaryAll'), value: summary?.all, color: 'text-foreground', onClick: () => handleStatusFilter('all'), active: statusFilter === 'all' },
    { key: 'active', label: t('pages.customers.summaryActive'), value: summary?.active, color: 'text-success', onClick: () => handleStatusFilter('active'), active: statusFilter === 'active' },
    { key: 'inactive', label: t('pages.customers.summaryInactive'), value: summary?.inactive, color: 'text-muted-foreground', onClick: () => handleStatusFilter('inactive'), active: statusFilter === 'inactive' },
  ];

  const activeFilterCount = statusFilter === 'all' ? 0 : 1;

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          title={t('pages.customers.title')}
          subtitle={t('pages.customers.subtitle')}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || items.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                {t('common.action.exportCsv')}
              </Button>
              <Can permission="customer.manage">
                <Button onClick={() => navigate('/customers/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">{t('pages.customers.addCustomer')}</span>
                  <span className="sm:hidden">{t('common.action.add')}</span>
                </Button>
              </Can>
            </>
          }
        />

        {/* ไม่มีแถบตัวเลขเมื่อ backend ไม่ส่ง summary มา (คำนวณล้ม) — ตารางยังใช้งานได้ */}
        {(summary || loading) && (
          <LicenseSummaryBand items={bandItems} loading={loading && !summary} error="" onRetry={() => fetchCustomers()} />
        )}

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2">
              <SearchInput
                ref={searchInputRef}
                value={searchTerm}
                onValueChange={handleSearchChange}
                placeholder={t('pages.customers.searchPlaceholder')}
                className="flex-1 sm:max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md" role="alert">{error}</div>}

            {!error && items.length === 0 && !loading ? (
              <ListEmptyState
                searchTerm={searchTerm}
                activeFilterCount={activeFilterCount}
                icon={Receipt}
                emptyTitle={t('pages.customers.emptyTitle')}
                emptyDescription={t('pages.customers.emptyDescription')}
                addAction={
                  <Can permission="customer.manage">
                    <Button size="sm" onClick={() => navigate('/customers/new')}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t('pages.customers.addCustomer')}
                    </Button>
                  </Can>
                }
              />
            ) : !error ? (
              <div className="relative">
                {loading && items.length === 0 ? (
                  <TableSkeleton columns={columns.length + 1} rows={paginate.perpage || 5} />
                ) : (
                  <>
                    {loading && (
                      <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10" role="status" aria-label={t('pages.customers.loadingAria')}>
                        <div className="text-muted-foreground">{t('pages.customers.loading')}</div>
                      </div>
                    )}
                    <DataTable
                      columns={columns}
                      data={items}
                      serverSide
                      tableLayout="auto"
                      totalRows={totalRows}
                      page={paginate.page}
                      perpage={paginate.perpage}
                      onPaginateChange={handlePaginateChange}
                      onSortChange={handleSortChange}
                      defaultSort={{ id: 'created_at', desc: true }}
                    />
                  </>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t('pages.customers.deleteTitle')}
        description={t('pages.customers.deleteDescription')}
        confirmText={t('common.action.delete')}
        confirmVariant="destructive"
        onConfirm={handleDelete}
      />

      <DevDebugSheet title="API Response" endpoint="GET /api-system/backstage/customers" data={rawResponse} />
    </Layout>
  );
};

export default CustomerManagement;

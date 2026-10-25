import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import { UserPicker } from '../../components/UserPicker';
import userBackstageService from '../../services/userBackstageService';
import roleService from '../../services/roleService';
import { fetchAllPages, type PagedResponse } from '../../utils/fetchAllPages';
import { fetchAllClusters } from '../../hooks/useAllClusters';
import { parseApiError } from '../../utils/errorParser';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { UserOption, BackstageUserScope } from '../../types';
import { useI18n } from '../../hooks/useI18n';

const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring';

interface GrantAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful grant so the page can refetch. */
  onGranted: () => void;
}

export const GrantAccessDialog: React.FC<GrantAccessDialogProps> = ({
  open, onOpenChange, onGranted,
}) => {
  const { t } = useI18n();
  const [user, setUser] = useState<UserOption | null>(null);
  const [roleOptions, setRoleOptions] = useState<{ id: string; name: string }[]>([]);
  const [clusterOptions, setClusterOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [scopeType, setScopeType] = useState<'platform' | 'cluster'>('platform');
  const [clusterId, setClusterId] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflictRoleIds, setConflictRoleIds] = useState<string[]>([]);

  // A ref, not state: Radix's DismissableLayer invokes onEscapeKeyDown through a callback
  // that does not reliably see this component's latest render, so a state value read
  // inside that closure can be stale. `.current` is dereferenced live at call time.
  const pickerOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    // Reset the Escape guard on open, not only on close: the dialog is controlled, so
    // closing it from code never fires Radix's onOpenChange, and a stale `true` here
    // would make a reopened dialog ignore Escape entirely.
    pickerOpenRef.current = false;
    setUser(null);
    setSelectedRoleIds([]);
    setScopeType('platform');
    setClusterId('');
    setConflictRoleIds([]);
    (async () => {
      try {
        const roles = await fetchAllPages<{ id: string; name: string }>(
          (page, perpage) =>
            roleService.getAll({ page, perpage, sort: 'name:asc' }) as Promise<PagedResponse<{ id: string; name: string }>>,
          { label: 'GrantAccessDialog.roles' },
        );
        setRoleOptions(roles.map((x) => ({ id: x.id, name: x.name })));
      } catch { /* the dialog still works with an empty list; the toast on submit explains */ }
      try {
        const clusters = await fetchAllClusters();
        setClusterOptions(clusters.map((x) => ({ id: x.id, name: x.name })));
      } catch { /* same */ }
    })();
  }, [open]);

  const toggleRole = (id: string) => {
    setConflictRoleIds([]);
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const handleSubmit = async () => {
    if (!user) { toast.error(t('pages.userBackstage.selectUserError')); return; }
    if (selectedRoleIds.length === 0) { toast.error(t('pages.userBackstage.selectRoleError')); return; }
    if (scopeType === 'cluster' && !clusterId) { toast.error(t('pages.userBackstage.selectClusterError')); return; }

    setSaving(true);
    setConflictRoleIds([]);
    try {
      const scope: BackstageUserScope =
        scopeType === 'cluster' ? { type: 'cluster', cluster_id: clusterId } : { type: 'platform' };
      await userBackstageService.assignBulk(user.id, { role_ids: selectedRoleIds, scope });
      toast.success(t('pages.userBackstage.accessGranted'));
      onOpenChange(false);
      pickerOpenRef.current = false;
      onGranted();
    } catch (err: unknown) {
      const { message } = parseApiError(err);
      // Nothing was written, so the dialog stays open with what was typed intact.
      const named = roleOptions
        .filter((r) => message.includes(r.name))
        .map((r) => r.id);
      setConflictRoleIds(named);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onEscapeKeyDown={(e) => { if (pickerOpenRef.current) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{t('pages.userBackstage.grantTitle')}</DialogTitle>
          <DialogDescription>
            {t('pages.userBackstage.grantDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="grant_user">{t('pages.userBackstage.userLabel')}</Label>
            <UserPicker
              id="grant_user"
              ariaLabel={t('pages.userBackstage.userPickerAria')}
              value={user}
              onChange={setUser}
              onDropdownOpenChange={(o) => { pickerOpenRef.current = o; }}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('pages.userBackstage.rolesLabel')}</Label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
              {roleOptions.length === 0 ? (
                <p className="text-muted-foreground p-2 text-sm">{t('pages.userBackstage.noBackstageRoles')}</p>
              ) : roleOptions.map((role) => (
                <label
                  key={role.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                    disabled={saving}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className={conflictRoleIds.includes(role.id) ? 'text-destructive' : ''}>
                    {role.name}
                  </span>
                  {conflictRoleIds.includes(role.id) && (
                    <span className="text-destructive text-xs">{t('pages.userBackstage.alreadyGranted')}</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grant_scope">{t('pages.userBackstage.scopeLabel')}</Label>
            <select
              id="grant_scope"
              value={scopeType}
              onChange={(e) => {
                setScopeType(e.target.value as 'platform' | 'cluster');
                setClusterId('');
                setConflictRoleIds([]);
              }}
              disabled={saving}
              className={selectClassName}
            >
              <option value="platform">{t('pages.userBackstage.backstageWide')}</option>
              <option value="cluster">{t('pages.userBackstage.scopeCluster')}</option>
            </select>
          </div>

          {scopeType === 'cluster' && (
            <div className="space-y-2">
              <Label htmlFor="grant_cluster">{t('pages.userBackstage.clusterLabel')}</Label>
              <select
                id="grant_cluster"
                value={clusterId}
                onChange={(e) => { setClusterId(e.target.value); setConflictRoleIds([]); }}
                disabled={saving}
                className={selectClassName}
              >
                <option value="">{t('pages.userBackstage.selectCluster')}</option>
                {clusterOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <ShieldCheck className="mr-2 h-4 w-4" />}
            {saving ? t('pages.userBackstage.granting') : t('pages.userBackstage.grantAccess')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Customer Categories Catalog Page
 * Tenant org_customer_category_cf CRUD
 * Route: /dashboard/catalog/customer-categories
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton, CmxCheckbox, CmxInput, CmxSelect, CmxSwitch } from '@ui/primitives';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/primitives/table';

import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogClose,
} from '@ui/overlays';
import { Label } from '@ui/primitives';
import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { useMessage, CmxConfirmDialog, CmxStatusBadge } from '@ui/feedback';
import {
  fetchCustomerCategories,
  createCustomerCategory,
  updateCustomerCategory,
  deleteCustomerCategory,
  checkCodeAvailable,
  type CustomerCategoryItem,
} from '@/lib/api/customer-categories';
import { generateCode, generateCustomerCategoryCode } from '@/lib/utils/generate-code';
import { RequireAnyPermission } from '@/src/features/auth/ui/RequirePermission';
import { CATALOG_CUSTOMER_CATEGORIES_ACCESS } from '@features/catalog/access/catalog-access';

/**
 *
 */
export default function CustomerCategoriesPage() {
  const t = useTranslations('catalog');
  const tPage = useTranslations('catalog.customerCategoriesPage');
  const tCommon = useTranslations('common');
  const { showErrorFrom, showSuccess } = useMessage();

  const [categories, setCategories] = useState<CustomerCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTargetCode, setDeleteTargetCode] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isCodeDirty, setIsCodeDirty] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    name2: '',
    system_type: 'walk_in' as string,
    is_b2b: false,
    is_individual: true,
    display_order: 0,
    is_active: true,
  });

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCustomerCategories({ active_only: false });
      setCategories(data);
    } catch (err) {
      showErrorFrom(err, { fallback: tPage('loadError') });
    } finally {
      setLoading(false);
    }
  }, [showErrorFrom]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openCreate = () => {
    setEditingCode(null);
    setIsCodeDirty(false);
    const nextDisplayOrder = categories.reduce(
      (max, c) => Math.max(max, c.display_order ?? 0),
      0
    ) + 1;
    setFormData({
      code: generateCustomerCategoryCode('', categories),
      name: '',
      name2: '',
      system_type: 'walk_in',
      is_b2b: false,
      is_individual: true,
      display_order: nextDisplayOrder,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (cat: CustomerCategoryItem) => {
    setEditingCode(cat.code);
    setIsCodeDirty(false);
    setFormData({
      code: cat.code,
      name: cat.name,
      name2: cat.name2 || '',
      system_type: cat.system_type || 'walk_in',
      is_b2b: cat.is_b2b,
      is_individual: cat.is_individual,
      display_order: cat.display_order ?? 0,
      is_active: cat.is_active,
    });
    setDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      ...(!isCodeDirty && !editingCode && {
        code: generateCustomerCategoryCode(name, categories),
      }),
    }));
  };

  const handleCodeChange = (code: string) => {
    setIsCodeDirty(true);
    setFormData((prev) => ({
      ...prev,
      code: code.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''),
    }));
  };

  const handleResetCode = () => {
    setIsCodeDirty(false);
    setFormData((prev) => ({
      ...prev,
      code: generateCustomerCategoryCode(prev.name, categories),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name || !formData.system_type) {
      showErrorFrom(new Error(tPage('requiredFields')));
      return;
    }

    setSaving(true);
    try {
      if (editingCode) {
        const isReserved = !!categories.find((c) => c.code === editingCode)?.system_category_code;
        await updateCustomerCategory(editingCode, {
          name: formData.name,
          name2: formData.name2 || undefined,
          display_order: formData.display_order,
          is_active: formData.is_active,
          ...(!isReserved && {
            system_type: formData.system_type,
            is_b2b: formData.is_b2b,
            is_individual: formData.is_individual,
          }),
        });
        showSuccess(tPage('updatedSuccess'));
      } else {
        await createCustomerCategory({
          code: formData.code,
          name: formData.name,
          name2: formData.name2 || undefined,
          system_type: formData.system_type,
          is_b2b: formData.is_b2b,
          is_individual: formData.is_individual,
          display_order: formData.display_order,
          is_active: formData.is_active,
        });
        showSuccess(tPage('createdSuccess'));
      }
      setDialogOpen(false);
      loadCategories();
    } catch (err) {
      showErrorFrom(err, { fallback: tPage('saveError') });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = (code: string) => {
    const cat = categories.find((c) => c.code === code);
    if (cat?.system_category_code) {
      showErrorFrom(new Error(tPage('cannotDeleteSystem')));
      return;
    }
    setDeleteTargetCode(code);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetCode) return;
    setDeleting(true);
    try {
      await deleteCustomerCategory(deleteTargetCode);
      showSuccess(tPage('deletedSuccess'));
      setDeleteTargetCode(null);
      loadCategories();
    } catch (err) {
      showErrorFrom(err, { fallback: tPage('deleteError') });
    } finally {
      setDeleting(false);
    }
  };

  const editingCategory = editingCode ? categories.find((c) => c.code === editingCode) : null;
  const isReserved = !!editingCategory?.system_category_code;
  const deleteTargetCategory = deleteTargetCode ? categories.find((c) => c.code === deleteTargetCode) : null;
  const systemTypes = [
    { value: 'guest', label: tPage('typeGuest') },
    { value: 'walk_in', label: tPage('typeWalkIn') },
    { value: 'stub', label: tPage('typeStub') },
    { value: 'b2b', label: tPage('typeB2b') },
  ];

  return (
    <div className="space-y-6" data-testid="customer-categories-catalog-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t('customerCategories')}
        </h1>
        <RequireAnyPermission
          permissions={CATALOG_CUSTOMER_CATEGORIES_ACCESS.actions?.manageCustomerCategories.requirement.permissions ?? []}
          fallback={null}
        >
          <CmxButton onClick={openCreate}>
            <Plus className="h-4 w-4 me-2" />
            {tCommon('add')}
          </CmxButton>
        </RequireAnyPermission>
      </div>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>
            {t('customerCategories')}
          </CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">{tCommon('loading')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-full text-sm">
                <TableHeader className="border-b">
                  <TableRow>
                    <TableHead className="text-start py-2 px-3 font-medium">{tPage('colCode')}</TableHead>
                    <TableHead className="text-start py-2 px-3 font-medium">{tPage('colName')}</TableHead>
                    <TableHead className="text-start py-2 px-3 font-medium">{tPage('colType')}</TableHead>
                    <TableHead className="text-start py-2 px-3 font-medium">{tPage('colB2b')}</TableHead>
                    <TableHead className="text-start py-2 px-3 font-medium">{tPage('colStatus')}</TableHead>
                    <RequireAnyPermission
                      permissions={CATALOG_CUSTOMER_CATEGORIES_ACCESS.actions?.manageCustomerCategories.requirement.permissions ?? []}
                      fallback={<TableHead />}
                    >
                      <TableHead className="text-end py-2 px-3 font-medium">{tPage('colActions')}</TableHead>
                    </RequireAnyPermission>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id} className="border-b last:border-0">
                      <TableCell className="py-2 px-3 font-mono">{cat.code}</TableCell>
                      <TableCell className="py-2 px-3">
                        <div>{cat.name}</div>
                        {cat.name2 && (
                          <div className="text-muted-foreground text-xs" dir="rtl">
                            {cat.name2}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-2 px-3">{cat.system_type || '—'}</TableCell>
                      <TableCell className="py-2 px-3">
                        <CmxStatusBadge size="sm" tone={cat.is_b2b ? 'brand' : 'neutral'}>
                          {cat.is_b2b ? t('yes') : t('no')}
                        </CmxStatusBadge>
                      </TableCell>
                      <TableCell className="py-2 px-3">
                        <div className="flex gap-1">
                          <CmxStatusBadge size="sm" tone={cat.is_active ? 'success' : 'neutral'}>
                            {cat.is_active ? tCommon('active') : tCommon('inactive')}
                          </CmxStatusBadge>
                          {cat.system_category_code && (
                            <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{tPage('systemBadge')}</CmxStatusBadge>
                          )}
                        </div>
                      </TableCell>
                      <RequireAnyPermission
                        permissions={CATALOG_CUSTOMER_CATEGORIES_ACCESS.actions?.manageCustomerCategories.requirement.permissions ?? []}
                        fallback={<TableCell />}
                      >
                        <TableCell className="py-2 px-3 text-end">
                          <CmxButton
                            variant="ghost"
                            size="sm"
                            aria-label={tCommon('edit')}
                            onClick={() => openEdit(cat)}
                          >
                            <Pencil className="h-4 w-4" />
                          </CmxButton>
                          <CmxButton
                            variant="ghost"
                            size="sm"
                            aria-label={tCommon('delete')}
                            onClick={() => handleDeleteRequest(cat.code)}
                            disabled={!!cat.system_category_code}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </CmxButton>
                        </TableCell>
                      </RequireAnyPermission>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CmxCardContent>
      </CmxCard>

      <CmxDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <CmxDialogContent className="max-w-2xl w-full mx-4">
          <CmxDialogHeader>
            <CmxDialogTitle>
              {editingCode ? tPage('editTitle') : tPage('createTitle')}
            </CmxDialogTitle>
          </CmxDialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>{tPage('nameEnLabel')} *</Label>
                <CmxInput
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={tPage('nameEnPlaceholder')}
                  required
                  className="w-full"
                />
              </div>
              <div>
                <Label>{tPage('codeLabel')} *</Label>
                <div className="flex gap-2">
                  <CmxInput
                    value={formData.code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="CUST_CTG_0001"
                    disabled={!!editingCode}
                    className="font-mono flex-1"
                  />
                  {!editingCode && isCodeDirty && (
                    <CmxButton type="button" variant="outline" size="xs" onClick={handleResetCode}>
                      <RotateCcw className="h-4 w-4" />
                    </CmxButton>
                  )}
                </div>
              </div>
              <div>
                <Label>{tPage('nameArLabel')}</Label>
                <CmxInput
                  value={formData.name2}
                  onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
                  placeholder={tPage('nameArPlaceholder')}
                  dir="rtl"
                  className="w-full"
                />
              </div>
              <div>
                <Label>{tPage('systemTypeLabel')}</Label>
                <CmxSelect
                  value={formData.system_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      system_type: e.target.value,
                      is_b2b: e.target.value === 'b2b',
                      is_individual: e.target.value !== 'b2b',
                    })
                  }
                  disabled={isReserved}
                  options={systemTypes}
                />
              </div>
              <div>
                <Label>{tPage('displayOrderLabel')}</Label>
                <CmxInput
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                  }
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-4 sm:col-span-2">
                <CmxCheckbox
                  checked={formData.is_b2b}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_b2b: e.target.checked,
                      is_individual: !e.target.checked,
                    })
                  }
                  disabled={isReserved}
                  label={tPage('colB2b')}
                />
                <div className="flex items-center gap-2">
                  <CmxSwitch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: !!v })}
                  />
                  <Label className="text-sm font-normal">{tCommon('active')}</Label>
                </div>
              </div>
            </div>
            <CmxDialogFooter>
              <CmxDialogClose asChild>
                <CmxButton type="button" variant="outline">
                  {tCommon('cancel')}
                </CmxButton>
              </CmxDialogClose>
              <CmxButton type="submit" disabled={saving} loading={saving}>
                {editingCode ? tCommon('save') : tCommon('create')}
              </CmxButton>
            </CmxDialogFooter>
          </form>
        </CmxDialogContent>
      </CmxDialog>

      <CmxConfirmDialog
        open={Boolean(deleteTargetCode)}
        title={tPage('deleteConfirmTitle')}
        description={
          deleteTargetCode
            ? tPage('deleteConfirmDesc', { name: deleteTargetCategory?.name ?? deleteTargetCode })
            : undefined
        }
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        confirmDisabled={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => { if (!deleting) setDeleteTargetCode(null); }}
      />
    </div>
  );
}

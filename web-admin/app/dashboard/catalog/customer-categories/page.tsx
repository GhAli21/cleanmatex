/**
 * Customer Categories Catalog Page
 * Tenant org_customer_category_cf CRUD
 * Route: /dashboard/catalog/customer-categories
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton, CmxInput, CmxSwitch } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
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
import { useMessage } from '@ui/feedback';
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

const SYSTEM_TYPES = [
  { value: 'guest', label: 'Guest' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'stub', label: 'Stub' },
  { value: 'b2b', label: 'B2B' },
] as const;

export default function CustomerCategoriesPage() {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const { showErrorFrom, showSuccess } = useMessage();

  const [categories, setCategories] = useState<CustomerCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
      showErrorFrom(err, { fallback: 'Failed to load customer categories' });
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
      showErrorFrom(new Error('Code, name, and system type are required'));
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
        showSuccess('Customer category updated');
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
        showSuccess('Customer category created');
      }
      setDialogOpen(false);
      loadCategories();
    } catch (err) {
      showErrorFrom(err, { fallback: 'Failed to save customer category' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (code: string) => {
    const cat = categories.find((c) => c.code === code);
    if (cat?.system_category_code) {
      showErrorFrom(new Error('Cannot delete system category'));
      return;
    }
    if (!confirm(`Delete "${cat?.name ?? code}"?`)) return;

    try {
      await deleteCustomerCategory(code);
      showSuccess('Customer category deleted');
      loadCategories();
    } catch (err) {
      showErrorFrom(err, { fallback: 'Failed to delete' });
    }
  };

  const editingCategory = editingCode ? categories.find((c) => c.code === editingCode) : null;
  const isReserved = !!editingCategory?.system_category_code;

  return (
    <div className="space-y-6" data-testid="customer-categories-catalog-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t('customerCategories') || 'Customer Categories'}
        </h1>
        <RequireAnyPermission permissions={['config:preferences_manage']} fallback={null}>
          <CmxButton onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {tCommon('add') || 'Add'}
          </CmxButton>
        </RequireAnyPermission>
      </div>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>
            {t('customerCategories') || 'Customer Categories'}
          </CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">Code</th>
                    <th className="text-left py-2 px-3 font-medium">Name</th>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-left py-2 px-3 font-medium">B2B</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <RequireAnyPermission permissions={['config:preferences_manage']} fallback={<th />}>
                      <th className="text-right py-2 px-3 font-medium">Actions</th>
                    </RequireAnyPermission>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id} className="border-b last:border-0">
                      <td className="py-2 px-3 font-mono">{cat.code}</td>
                      <td className="py-2 px-3">
                        <div>{cat.name}</div>
                        {cat.name2 && (
                          <div className="text-muted-foreground text-xs" dir="rtl">
                            {cat.name2}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3">{cat.system_type || '—'}</td>
                      <td className="py-2 px-3">
                        <Badge variant={cat.is_b2b ? 'default' : 'secondary'}>
                          {cat.is_b2b ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1">
                          <Badge variant={cat.is_active ? 'success' : 'secondary'}>
                            {cat.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {cat.system_category_code && (
                            <Badge variant="outline">System</Badge>
                          )}
                        </div>
                      </td>
                      <RequireAnyPermission permissions={['config:preferences_manage']} fallback={<td />}>
                        <td className="py-2 px-3 text-right">
                          <CmxButton
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(cat)}
                          >
                            <Pencil className="h-4 w-4" />
                          </CmxButton>
                          <CmxButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(cat.code)}
                            disabled={!!cat.system_category_code}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </CmxButton>
                        </td>
                      </RequireAnyPermission>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CmxCardContent>
      </CmxCard>

      <CmxDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <CmxDialogContent className="max-w-2xl w-full mx-4">
          <CmxDialogHeader>
            <CmxDialogTitle>
              {editingCode ? 'Edit Customer Category' : 'New Customer Category'}
            </CmxDialogTitle>
          </CmxDialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Name (English) *</Label>
                <CmxInput
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Walk-in"
                  required
                  className="w-full"
                />
              </div>
              <div>
                <Label>Code *</Label>
                <div className="flex gap-2">
                  <CmxInput
                    value={formData.code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="CUST_CTG_0001"
                    disabled={!!editingCode}
                    className="font-mono flex-1"
                  />
                  {!editingCode && isCodeDirty && (
                    <CmxButton type="button" variant="outline" size="icon" onClick={handleResetCode}>
                      <RotateCcw className="h-4 w-4" />
                    </CmxButton>
                  )}
                </div>
              </div>
              <div>
                <Label>Name (Arabic)</Label>
                <CmxInput
                  value={formData.name2}
                  onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
                  placeholder="عميل وافد"
                  dir="rtl"
                  className="w-full"
                />
              </div>
              <div>
                <Label>System Type</Label>
                <select
                  className="w-full h-9 rounded-md border px-3"
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
                >
                  {SYSTEM_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Display Order</Label>
                <CmxInput
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                  }
                  className="w-full"
                />
              </div>
              <div className="flex gap-4 sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_b2b}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_b2b: e.target.checked,
                        is_individual: !e.target.checked,
                      })
                    }
                    disabled={isReserved}
                  />
                  <span className="text-sm">B2B</span>
                </label>
                <label className="flex items-center gap-2">
                  <CmxSwitch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: !!v })}
                  />
                  <span className="text-sm">Active</span>
                </label>
              </div>
            </div>
            <CmxDialogFooter>
              <CmxDialogClose asChild>
                <CmxButton type="button" variant="outline">
                  {tCommon('cancel')}
                </CmxButton>
              </CmxDialogClose>
              <CmxButton type="submit" disabled={saving} loading={saving}>
                {editingCode ? 'Save' : 'Create'}
              </CmxButton>
            </CmxDialogFooter>
          </form>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from '@/components/ui';
import { useAuth } from "@/lib/auth/auth-context";

interface ServiceCategory {
  service_category_code: string;
  ctg_name: string;
  ctg_name2: string | null;
  ctg_desc: string | null;
  is_active: boolean;
}

export default function CategoriesPage() {
  const t = useTranslations("catalog");
  const { currentTenant } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [enabledCodes, setEnabledCodes] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isRtl = useMemo(() => typeof document !== "undefined" && document.dir === "rtl", []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!currentTenant) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [globalRes, enabledRes] = await Promise.all([
          fetch("/api/v1/categories").then((r) => r.json()),
          fetch("/api/v1/categories?enabled=true").then((r) => r.json()),
        ]);

        if (!globalRes?.data) throw new Error("Failed to load categories");

        const all: ServiceCategory[] = globalRes.data;
        const enabled = new Set<string>((enabledRes?.data || []).map((c: any) => c.service_category_code));

        if (mounted) {
          setCategories(all);
          setEnabledCodes(enabled);
        }
      } catch (e: any) {
        if (mounted) setError(e.message || "Failed to load categories");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [currentTenant]);

  function toggleCategory(code: string) {
    setEnabledCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/v1/categories/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryCodes: Array.from(enabledCodes) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save");
      setSuccess(t("categoriesEnabled"));
    } catch (e: any) {
      setError(e.message || t("validationErrors"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("categories")}</h1>
        <div className="flex items-center gap-2">
          <Button onClick={onSave} disabled={saving || loading}>
            {saving ? t("loading") : t("saveCategories")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-green-700">
          {success}
        </div>
      )}

      <Card className="p-4">
        {loading ? (
          <div className="text-gray-500">{t("loading")}</div>
        ) : categories.length === 0 ? (
          <div className="text-gray-500">{t("noCategories")}</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((ctg) => {
              const enabled = enabledCodes.has(ctg.service_category_code);
              return (
                <div
                  key={ctg.service_category_code}
                  className="flex items-start justify-between rounded-md border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {isRtl ? ctg.ctg_name2 || ctg.ctg_name : ctg.ctg_name}
                      </span>
                      {enabled ? (
                        <Badge variant="success">{t("standard")}</Badge>
                      ) : (
                        <Badge variant="default">{t("disableCategories")}</Badge>
                      )}
                    </div>
                    {ctg.ctg_desc && (
                      <p className="text-sm text-gray-600">{ctg.ctg_desc}</p>
                    )}
                    <p className="text-xs text-gray-400">{ctg.service_category_code}</p>
                  </div>

                  <Switch
                    checked={enabled}
                    onCheckedChange={() => toggleCategory(ctg.service_category_code)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

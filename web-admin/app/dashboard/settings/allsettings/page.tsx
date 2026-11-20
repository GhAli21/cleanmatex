/**
 * All Settings Page
 *
 * Consolidated view for advanced settings:
 * - System profile
 * - 7-layer settings resolution info
 * - Tenant / Branch / User settings
 * - Feature flags and plan limits
 *
 * Route: /dashboard/settings/allsettings (protected)
 */

"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { CmxCard } from "@ui/primitives/cmx-card";

import { CmxButton } from "@ui/primitives";
import { CmxTabsPanel } from "@ui/navigation";
import { Info, HelpCircle } from "lucide-react";
import type { Tenant } from "@/lib/types/tenant";
import { TenantSettings } from "@features/settings/ui/TenantSettings";
import { BranchSettings } from "@features/settings/ui/BranchSettings";
import { UserSettings } from "@features/settings/ui/UserSettings";
import { FeatureFlagsSettings } from "@features/settings/ui/FeatureFlagsSettings";
import { PlanLimitsSettings } from "@features/settings/ui/PlanLimitsSettings";
import { ProfileInfoCard } from "@features/settings/ui/profile-info-card";

import { CmxStatusBadge } from '@ui/feedback';
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';
/**
 *
 */
export default function AllSettingsPage() {
  const tSettings = useTranslations("settings");
  const t = useTranslations("settings.advancedSettings");
  const tCommon = useTranslations("common");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      // Fetch tenant data
      const tenantResponse = await fetch("/api/v1/tenants/me");
      const tenantData = await tenantResponse.json();

      if (!tenantResponse.ok) {
        throw new Error(tenantData.error || t("loadErrorTenant"));
      }

      setTenant(tenantData.data);

      // Each tab loads the settings required for its own scope, avoiding a stale global HQ dependency.
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadErrorTenant"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecompute = async () => {
    try {
      await fetchData();
    } catch (err) {
      console.error("Failed to recompute settings:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">{t("loadingSettings")}</p>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CmxSummaryMessage type="error" title={tSettings("loadError")} message={error || undefined} />
      </div>
    );
  }

  const tabs = [
    {
      id: "tenant-settings",
      label: t("tabOrganization"),
      icon: <span>🧩</span>,
      content: <TenantSettings />,
    },
    {
      id: "branch-settings",
      label: t("tabBranch"),
      icon: <span>🏬</span>,
      content: <BranchSettings />,
    },
    {
      id: "user-settings",
      label: t("tabUser"),
      icon: <span>👤</span>,
      content: <UserSettings />,
    },
    {
      id: "feature-flags",
      label: t("tabFeatureFlags"),
      icon: <span>🚩</span>,
      content: <FeatureFlagsSettings />,
    },
    {
      id: "plan-limits",
      label: t("tabPlanLimits"),
      icon: <span>📊</span>,
      content: <PlanLimitsSettings />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Tenant status badge (optional, no duplicate header) */}
      <div className="mb-4 flex justify-end">
        <CmxStatusBadge size="sm" tone={tenant.status === "trial" ? "warning" : "success"}>
          {tenant.status === "trial" ? t("trialAccount") : tCommon("active")}
        </CmxStatusBadge>
      </div>

      {/* Profile Info Card */}
      <div className="mb-6">
        <ProfileInfoCard onRecompute={handleRecompute} />
      </div>

      {/* Info Banner */}
      <div className="mb-6">
        <CmxCard className="bg-info-bg border-info-border">
          <div className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-primary-text flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-primary-text">
                {t("resolutionTitle")}
              </h3>
              <p className="mt-1 text-sm text-primary-text">
                {t("resolutionDescription")}
              </p>
              <CmxButton
                variant="ghost"
                size="sm"
                className="mt-2 text-primary-text hover:text-primary-text/80 p-0 h-auto"
              >
                <HelpCircle className="h-4 w-4 me-1" />
                {t("learnMore")}
              </CmxButton>
            </div>
          </div>
        </CmxCard>
      </div>

      {/* Advanced Settings Tabs */}
      <CmxTabsPanel tabs={tabs} defaultTab="tenant-settings" />
    </div>
  );
}

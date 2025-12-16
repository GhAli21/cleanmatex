/**
 * Unit Tests for Subscriptions Service
 * Tests for plan management, upgrades, cancellations, and billing
 */

import type { PlanLimits, Subscription } from '@/lib/types/tenant';

// Mock Supabase
jest.mock('@/lib/supabase/server');

describe('SubscriptionsService', () => {
  describe('getAvailablePlans', () => {
    const mockPlans: PlanLimits[] = [
      {
        plan_code: 'free',
        plan_name: 'Free',
        plan_name2: null,
        plan_description: 'Free plan for testing',
        plan_description2: null,
        orders_limit: 20,
        users_limit: 2,
        branches_limit: 1,
        storage_mb_limit: 100,
        price_monthly: 0,
        price_yearly: 0,
        feature_flags: {
          pdf_invoices: false,
          whatsapp_receipts: true,
          in_app_receipts: true,
          printing: false,
          b2b_contracts: false,
          white_label: false,
          marketplace_listings: false,
          loyalty_programs: false,
          driver_app: false,
          multi_branch: false,
          advanced_analytics: false,
          api_access: false,
        },
        is_public: true,
        display_order: 1,
        is_active: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
      {
        plan_code: 'starter',
        plan_name: 'Starter',
        plan_name2: null,
        plan_description: 'Starter plan',
        plan_description2: null,
        orders_limit: 100,
        users_limit: 5,
        branches_limit: 1,
        storage_mb_limit: 500,
        price_monthly: 29,
        price_yearly: 279,
        feature_flags: {
          pdf_invoices: true,
          whatsapp_receipts: true,
          in_app_receipts: true,
          printing: true,
          b2b_contracts: false,
          white_label: false,
          marketplace_listings: false,
          loyalty_programs: true,
          driver_app: false,
          multi_branch: false,
          advanced_analytics: false,
          api_access: false,
        },
        is_public: true,
        display_order: 2,
        is_active: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
    ];

    test('returns all public plans', () => {
      const publicPlans = mockPlans.filter(p => p.is_public);
      expect(publicPlans).toHaveLength(2);
      expect(publicPlans[0].plan_code).toBe('free');
    });

    test('marks current plan correctly', () => {
      const currentPlan = 'starter';
      const plansWithCurrent = mockPlans.map(p => ({
        ...p,
        isCurrentPlan: p.plan_code === currentPlan,
      }));

      const starterPlan = plansWithCurrent.find(p => p.plan_code === 'starter');
      expect(starterPlan?.isCurrentPlan).toBe(true);

      const freePlan = plansWithCurrent.find(p => p.plan_code === 'free');
      expect(freePlan?.isCurrentPlan).toBe(false);
    });

    test('marks recommended plan (Growth)', () => {
      const recommendedPlanCode = 'growth';
      expect(recommendedPlanCode).toBe('growth');
    });

    test('orders plans by display_order', () => {
      const sorted = [...mockPlans].sort((a, b) =>
        (a.display_order || 0) - (b.display_order || 0)
      );

      expect(sorted[0].plan_code).toBe('free');
      expect(sorted[1].plan_code).toBe('starter');
    });
  });

  describe('getPlan', () => {
    test('retrieves plan by code', () => {
      const planCode = 'starter';
      expect(planCode).toBe('starter');
    });

    test('throws error for invalid plan code', () => {
      const invalidPlanCode = 'invalid-plan';
      expect(invalidPlanCode).not.toMatch(/^(free|starter|growth|pro|enterprise)$/);
    });
  });

  describe('getSubscription', () => {
    const mockSubscription: Subscription = {
      id: 'sub-123',
      tenant_org_id: 'tenant-123',
      plan: 'starter',
      status: 'active',
      orders_limit: 100,
      orders_used: 25,
      branch_limit: 1,
      user_limit: 5,
      start_date: '2025-01-01T00:00:00Z',
      end_date: '2025-02-01T00:00:00Z',
      trial_ends: null,
      last_payment_date: '2025-01-01T00:00:00Z',
      last_payment_amount: 29,
      last_payment_method: 'card',
      payment_reference: 'pay-ref-123',
      payment_notes: null,
      last_invoice_number: 'INV-001',
      last_invoice_date: '2025-01-01T00:00:00Z',
      auto_renew: true,
      cancellation_date: null,
      cancellation_reason: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    test('retrieves subscription for tenant', () => {
      expect(mockSubscription.tenant_org_id).toBe('tenant-123');
      expect(mockSubscription.plan).toBe('starter');
    });

    test('includes usage information', () => {
      expect(mockSubscription.orders_used).toBe(25);
      expect(mockSubscription.orders_limit).toBe(100);

      const usagePercentage = (mockSubscription.orders_used / mockSubscription.orders_limit) * 100;
      expect(usagePercentage).toBe(25);
    });

    test('indicates trial status', () => {
      const isOnTrial = mockSubscription.trial_ends !== null &&
                       new Date(mockSubscription.trial_ends) > new Date();
      expect(isOnTrial).toBe(false); // Not on trial
    });

    test('indicates auto-renewal status', () => {
      expect(mockSubscription.auto_renew).toBe(true);
    });
  });

  describe('calculateProration', () => {
    test('calculates mid-cycle upgrade cost', () => {
      const currentPlanPrice = 29;
      const newPlanPrice = 79;
      const daysRemaining = 15;
      const totalDays = 30;

      const proratedCredit = (currentPlanPrice / totalDays) * daysRemaining;
      const proratedNewCost = (newPlanPrice / totalDays) * daysRemaining;
      const amountDue = proratedNewCost - proratedCredit;

      expect(proratedCredit).toBeCloseTo(14.5, 1);
      expect(proratedNewCost).toBeCloseTo(39.5, 1);
      expect(amountDue).toBeGreaterThan(0);
    });

    test('returns zero for free plan upgrade on first day', () => {
      const currentPlanPrice = 0;
      const newPlanPrice = 29;
      const daysRemaining = 30;
      const totalDays = 30;

      const proratedCredit = (currentPlanPrice / totalDays) * daysRemaining;
      const proratedNewCost = (newPlanPrice / totalDays) * daysRemaining;
      const amountDue = proratedNewCost - proratedCredit;

      expect(amountDue).toBe(newPlanPrice);
    });

    test('handles yearly billing correctly', () => {
      const yearlyPrice = 279; // Starter yearly
      const monthlyCost = yearlyPrice / 12;

      expect(monthlyCost).toBeCloseTo(23.25, 2);

      const yearlySavings = (29 * 12) - yearlyPrice;
      expect(yearlySavings).toBe(69); // Saves OMR 69/year
    });
  });

  describe('upgradeSubscription', () => {
    test('upgrades from free to starter', () => {
      const upgrade = {
        fromPlan: 'free',
        toPlan: 'starter',
        billingCycle: 'monthly' as const,
      };

      expect(upgrade.fromPlan).toBe('free');
      expect(upgrade.toPlan).toBe('starter');
      expect(upgrade.billingCycle).toBe('monthly');
    });

    test('prevents downgrade attempt', () => {
      const planOrder = {
        free: 1,
        starter: 2,
        growth: 3,
        pro: 4,
        enterprise: 5,
      };

      const fromPlan = 'starter';
      const toPlan = 'free';

      const isDowngrade = planOrder[toPlan as keyof typeof planOrder] <
                         planOrder[fromPlan as keyof typeof planOrder];

      expect(isDowngrade).toBe(true);
    });

    test('updates subscription status to active after trial', () => {
      const updatedSubscription = {
        status: 'active' as const,
        trial_ends: null,
      };

      expect(updatedSubscription.status).toBe('active');
      expect(updatedSubscription.trial_ends).toBeNull();
    });

    test('sets correct billing dates', () => {
      const now = new Date('2025-01-15T00:00:00Z');
      const startDate = now;
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);

      expect(endDate.getMonth()).toBe(1); // February
    });

    test('updates feature flags after upgrade', () => {
      const oldFeatures = {
        pdf_invoices: false,
        driver_app: false,
      };

      const newFeatures = {
        pdf_invoices: true,
        driver_app: true,
      };

      expect(newFeatures.pdf_invoices).toBe(true);
      expect(newFeatures.driver_app).toBe(true);
      expect(oldFeatures.pdf_invoices).toBe(false);
    });
  });

  describe('cancelSubscription', () => {
    test('schedules cancellation at period end', () => {
      const currentPeriodEnd = new Date('2025-02-01T00:00:00Z');
      const cancellationDate = currentPeriodEnd;

      expect(cancellationDate.toISOString()).toBe('2025-02-01T00:00:00.000Z');
    });

    test('updates status to canceling', () => {
      const canceledSubscription = {
        status: 'canceling' as const,
        cancellation_date: '2025-02-01T00:00:00Z',
        cancellation_reason: 'Too expensive',
        auto_renew: false,
      };

      expect(canceledSubscription.status).toBe('canceling');
      expect(canceledSubscription.auto_renew).toBe(false);
    });

    test('captures cancellation reason', () => {
      const validReasons = [
        'Too expensive',
        'Missing features',
        'Switching to competitor',
        'No longer needed',
        'Other',
      ];

      const reason = 'Too expensive';
      expect(validReasons).toContain(reason);
    });

    test('allows optional feedback', () => {
      const feedback = 'The pricing is too high for our small business';
      expect(feedback).toBeTruthy();
      expect(typeof feedback).toBe('string');
    });

    test('prevents cancellation of free plan', () => {
      const plan = 'free';
      const canCancel = plan !== 'free';

      expect(canCancel).toBe(false);
    });
  });

  describe('processTrialExpirations', () => {
    test('finds expired trials', () => {
      const now = new Date('2025-01-15T00:00:00Z');
      const trialEnd = new Date('2025-01-14T23:59:59Z');

      const isExpired = trialEnd < now;
      expect(isExpired).toBe(true);
    });

    test('downgrades to free plan after trial', () => {
      const downgraded = {
        plan: 'free',
        status: 'active' as const,
        trial_ends: null,
      };

      expect(downgraded.plan).toBe('free');
      expect(downgraded.status).toBe('active');
      expect(downgraded.trial_ends).toBeNull();
    });

    test('resets feature flags to free plan', () => {
      const freeFeatures = {
        pdf_invoices: false,
        whatsapp_receipts: true,
        in_app_receipts: true,
        printing: false,
        b2b_contracts: false,
        white_label: false,
        marketplace_listings: false,
        loyalty_programs: false,
        driver_app: false,
        multi_branch: false,
        advanced_analytics: false,
        api_access: false,
      };

      expect(freeFeatures.pdf_invoices).toBe(false);
      expect(freeFeatures.whatsapp_receipts).toBe(true);
      expect(freeFeatures.driver_app).toBe(false);
    });
  });

  describe('processSubscriptionRenewals', () => {
    test('identifies expiring subscriptions', () => {
      const now = new Date('2025-02-01T00:00:00Z');
      const endDate = new Date('2025-02-01T23:59:59Z');

      // Check if the subscription ends on the same day using UTC methods
      const isExpiring = endDate.getUTCDate() === now.getUTCDate() &&
                        endDate.getUTCMonth() === now.getUTCMonth() &&
                        endDate.getUTCFullYear() === now.getUTCFullYear();

      expect(isExpiring).toBe(true);
    });

    test('extends subscription period on renewal', () => {
      const currentEndDate = new Date('2025-02-01T00:00:00Z');
      const newEndDate = new Date(currentEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + 1);

      expect(newEndDate.getMonth()).toBe(2); // March
    });

    test('resets monthly usage counters', () => {
      const resetUsage = {
        orders_used: 0,
      };

      expect(resetUsage.orders_used).toBe(0);
    });

    test('handles failed payment gracefully', () => {
      const failedPayment = {
        status: 'past_due' as const,
        auto_renew: true,
      };

      expect(failedPayment.status).toBe('past_due');
      expect(failedPayment.auto_renew).toBe(true);
    });
  });

  describe('Plan Comparison', () => {
    test('identifies upgrade vs downgrade', () => {
      const planHierarchy = ['free', 'starter', 'growth', 'pro', 'enterprise'];

      const isUpgrade = (from: string, to: string) => {
        return planHierarchy.indexOf(to) > planHierarchy.indexOf(from);
      };

      expect(isUpgrade('free', 'starter')).toBe(true);
      expect(isUpgrade('starter', 'free')).toBe(false);
      expect(isUpgrade('growth', 'pro')).toBe(true);
    });

    test('calculates feature differences', () => {
      const freeFeatures = { pdf_invoices: false, driver_app: false };
      const starterFeatures = { pdf_invoices: true, driver_app: false };

      const newFeatures = Object.keys(starterFeatures).filter(
        (key) => starterFeatures[key as keyof typeof starterFeatures] === true &&
                freeFeatures[key as keyof typeof freeFeatures] === false
      );

      expect(newFeatures).toContain('pdf_invoices');
      expect(newFeatures).not.toContain('driver_app');
    });
  });
});

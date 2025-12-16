'use client'

/**
 * Subscription Settings Page
 *
 * Displays and manages subscription:
 * - Current plan details
 * - Billing information
 * - Usage statistics
 * - Upgrade/downgrade options
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CreditCard, Calendar, TrendingUp, Check, Zap } from 'lucide-react'

interface Plan {
  id: string
  name: string
  price: number
  interval: 'month' | 'year'
  features: string[]
  limits: {
    orders: number
    users: number
    branches: number
  }
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    interval: 'month',
    features: ['500 orders/month', '3 users', '1 branch', 'Basic reports', 'Email support'],
    limits: { orders: 500, users: 3, branches: 1 }
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 79,
    interval: 'month',
    features: ['2000 orders/month', '10 users', '3 branches', 'Advanced reports', 'Priority support', 'WhatsApp integration'],
    limits: { orders: 2000, users: 10, branches: 3 }
  },
  {
    id: 'pro',
    name: 'Professional',
    price: 199,
    interval: 'month',
    features: ['Unlimited orders', 'Unlimited users', '10 branches', 'Custom reports', '24/7 support', 'API access', 'White label'],
    limits: { orders: -1, users: -1, branches: 10 }
  }
]

export default function SubscriptionSettingsPage() {
  const t = useTranslations('settings')
  const [currentPlan] = useState('growth')

  const formatLimit = (value: number) => {
    return value === -1 ? t('unlimited') : value.toLocaleString()
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Current Subscription */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-6 w-6" />
              <h2 className="text-2xl font-bold">{PLANS.find(p => p.id === currentPlan)?.name} {t('plan')}</h2>
            </div>
            <p className="text-blue-100">{t('currentSubscription')}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              ${PLANS.find(p => p.id === currentPlan)?.price}
              <span className="text-lg font-normal">/{t('month')}</span>
            </div>
            <p className="text-blue-100 text-sm mt-1">{t('billedMonthly')}</p>
          </div>
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">{t('ordersThisMonth')}</span>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">847</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '42%' }}></div>
            </div>
            <span className="text-xs text-gray-500">42%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">of 2,000 limit</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">{t('activeUsers')}</span>
            <CreditCard className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">6</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div className="bg-green-600 h-2 rounded-full" style={{ width: '60%' }}></div>
            </div>
            <span className="text-xs text-gray-500">60%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">of 10 limit</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">{t('branches')}</span>
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">2</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full" style={{ width: '67%' }}></div>
            </div>
            <span className="text-xs text-gray-500">67%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">of 3 limit</p>
        </div>
      </div>

      {/* Billing Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('billingInformation')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600">{t('nextBillingDate')}</label>
            <p className="text-base font-medium text-gray-900 mt-1">December 1, 2024</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">{t('paymentMethod')}</label>
            <p className="text-base font-medium text-gray-900 mt-1">•••• •••• •••• 4242</p>
          </div>
        </div>
      </div>

      {/* Available Plans */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('availablePlans')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-lg shadow-sm border-2 p-6 ${
                  isCurrent ? 'border-blue-500' : 'border-gray-200'
                }`}
              >
                {isCurrent && (
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full mb-4">
                    {t('currentPlan')}
                  </span>
                )}
                <h4 className="text-xl font-bold text-gray-900">{plan.name}</h4>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-600">/{t('month')}</span>
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  disabled={isCurrent}
                  className={`w-full mt-6 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isCurrent
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isCurrent ? t('current') : t('upgrade')}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

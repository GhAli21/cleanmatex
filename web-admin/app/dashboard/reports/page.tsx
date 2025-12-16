'use client'

/**
 * Reports Hub Page
 *
 * Central page for accessing various business reports
 */

import { useTranslations } from 'next-intl'
import {
  TrendingUp,
  FileText,
  Clock,
  Download,
  Calendar,
  DollarSign,
  Package,
  Users
} from 'lucide-react'
import { useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Mock data
const revenueData = [
  { date: 'Mon', revenue: 1200 },
  { date: 'Tue', revenue: 1800 },
  { date: 'Wed', revenue: 2100 },
  { date: 'Thu', revenue: 1600 },
  { date: 'Fri', revenue: 2400 },
  { date: 'Sat', revenue: 2800 },
  { date: 'Sun', revenue: 1500 }
]

const ordersData = [
  { status: 'Completed', count: 145 },
  { status: 'Processing', count: 32 },
  { status: 'Pending', count: 18 },
  { status: 'Cancelled', count: 5 }
]

export default function ReportsPage() {
  const t = useTranslations('reports')
  const [dateRange, setDateRange] = useState('7days')

  const stats = [
    { label: t('totalRevenue'), value: '$12,450', icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
    { label: t('totalOrders'), value: '200', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: t('avgOrderValue'), value: '$62.25', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: t('activeCustomers'), value: '156', icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' }
  ]

  const handleExport = (format: 'csv' | 'pdf') => {
    console.log(`Exporting as ${format}`)
    // TODO: Implement export functionality
    alert(`Exporting report as ${format.toUpperCase()}...`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            {t('exportCSV')}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            {t('exportPDF')}
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-gray-600" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="today">{t('today')}</option>
            <option value="7days">{t('last7Days')}</option>
            <option value="30days">{t('last30Days')}</option>
            <option value="custom">{t('customRange')}</option>
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">{stat.label}</span>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {t('revenueReport')}
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Orders Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t('ordersReport')}
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={ordersData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="status" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#10B981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* SLA Report */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t('slaReport')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="text-sm text-gray-600">{t('avgTurnaroundTime')}</label>
            <p className="text-2xl font-bold text-gray-900 mt-1">48 {t('hours')}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">{t('onTimeDelivery')}</label>
            <p className="text-2xl font-bold text-green-600 mt-1">94%</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">{t('avgResponseTime')}</label>
            <p className="text-2xl font-bold text-gray-900 mt-1">2.5 {t('hours')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useAuth } from '@/lib/auth/auth-context'
import DashboardContent from '@features/dashboard/ui/DashboardContent'

export default function DashboardPage() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="win2k-panel" style={{ padding: 0, minWidth: 300 }}>
          <div className="win2k-titlebar">
            <span>CleanMateX — Loading</span>
          </div>
          <div style={{ padding: 16, backgroundColor: 'var(--win2k-face)' }}>
            <div className="win2k-inset" style={{ padding: '6px 8px', marginBottom: 8 }}>
              <p className="win2k-text">Please wait while the dashboard loads...</p>
            </div>
            <div className="win2k-progress-track">
              <div className="win2k-progress-fill" style={{ width: '100%', animation: 'none' }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <DashboardContent />
}

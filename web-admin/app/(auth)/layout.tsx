/**
 * Auth Layout
 *
 * Layout for authentication pages (login, register, forgot password, etc.)
 * Provides a clean, centered layout without navigation
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}

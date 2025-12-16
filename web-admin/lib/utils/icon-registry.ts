/**
 * Icon Registry
 * 
 * Maps icon name strings to LucideIcon components
 * Used to convert database icon names to React components
 */

import type { LucideIcon } from 'lucide-react'
import {
  Home,
  PackageSearch,
  ScanBarcode,
  Truck,
  Users,
  Tags,
  Receipt,
  BarChart3,
  Boxes,
  Settings,
  LifeBuoy,
  ClipboardCheck,
  Settings2,
  CheckCircle,
  CircleCheck,
  Bug,
} from 'lucide-react'

/**
 * Icon registry mapping icon names to LucideIcon components
 */
export const ICON_REGISTRY: Record<string, LucideIcon> = {
  Home,
  PackageSearch,
  ScanBarcode,
  Truck,
  Users,
  Tags,
  Receipt,
  BarChart3,
  Boxes,
  Settings,
  LifeBuoy,
  ClipboardCheck,
  Settings2,
  CheckCircle,
  CircleCheck,
  Bug,
}

/**
 * Get icon component by name
 * @param iconName Icon name from database (e.g., "Home", "PackageSearch")
 * @param fallback Fallback icon if not found (defaults to Home)
 * @returns LucideIcon component
 */
export function getIcon(
  iconName: string | null | undefined,
  fallback: LucideIcon = Home
): LucideIcon {
  if (!iconName) {
    return fallback
  }

  // Try exact match first
  if (ICON_REGISTRY[iconName]) {
    return ICON_REGISTRY[iconName]
  }

  // Try case-insensitive match
  const lowerName = iconName.toLowerCase()
  const found = Object.keys(ICON_REGISTRY).find(
    (key) => key.toLowerCase() === lowerName
  )

  if (found) {
    return ICON_REGISTRY[found]
  }

  // Return fallback if not found
  console.warn(`Icon "${iconName}" not found in registry, using fallback`)
  return fallback
}

/**
 * Check if icon name is valid
 * @param iconName Icon name to check
 * @returns True if icon exists in registry
 */
export function isValidIcon(iconName: string): boolean {
  if (!iconName) return false

  // Check exact match
  if (ICON_REGISTRY[iconName]) return true

  // Check case-insensitive match
  const lowerName = iconName.toLowerCase()
  return Object.keys(ICON_REGISTRY).some(
    (key) => key.toLowerCase() === lowerName
  )
}

/**
 * Get all available icon names
 * @returns Array of icon names
 */
export function getAvailableIcons(): string[] {
  return Object.keys(ICON_REGISTRY)
}

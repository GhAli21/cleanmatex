/**
 * Category Tabs Component
 * Horizontal tabs for selecting service categories
 * PRD-010: New Order UI
 */

'use client';

import { memo } from 'react';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/utils/bilingual';
import {
  Scissors,
  Droplet,
  Zap,
  Shirt,
  Wrench,
  Sparkles,
  Package,
  type LucideIcon,
} from 'lucide-react';

interface ServiceCategory {
  service_category_code: string;
  ctg_name: string;
  ctg_name2: string;
  service_category_icon?: string;
  service_category_color1?: string;
}

interface CategoryTabsProps {
  categories: ServiceCategory[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

/**
 * Map icon name string to Lucide icon component
 */
function getIconComponent(iconName?: string): LucideIcon | null {
  if (!iconName) return null;

  // Map database icon names to Lucide icon components
  // Note: Some icons like "Iron" and "WashingMachine" don't exist in Lucide,
  // so we use alternatives (Zap for Iron, Sparkles for WashingMachine)
  const iconMap: Record<string, LucideIcon> = {
    Scissors: Scissors,
    Drop: Droplet,
    Droplet: Droplet,
    Iron: Zap, // Iron icon not available in Lucide, using Zap as alternative
    Zap: Zap,
    Shirt: Shirt,
    Wrench: Wrench,
    WashingMachine: Sparkles, // WashingMachine icon not available in Lucide, using Sparkles as alternative
    Sparkles: Sparkles,
    Package: Package,
  };

  // Try exact match first
  if (iconMap[iconName]) {
    return iconMap[iconName];
  }

  // Try case-insensitive match
  const lowerIconName = iconName.toLowerCase();
  const matchedKey = Object.keys(iconMap).find(
    (key) => key.toLowerCase() === lowerIconName
  );

  return matchedKey ? iconMap[matchedKey] : null;
}

export const CategoryTabs = memo(function CategoryTabs({ categories, selectedCategory, onSelectCategory }: CategoryTabsProps) {
  const isRTL = useRTL();
  const getBilingual = useBilingual();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {categories.map((category) => {
          const IconComponent = getIconComponent(category.service_category_icon);
          const displayName = getBilingual(category.ctg_name, category.ctg_name2) || 'No Category Name';

          return (
            <button
              key={category.service_category_code}
              onClick={() => onSelectCategory(category.service_category_code)}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center ${isRTL ? 'flex-row-reverse gap-2' : 'gap-2'} ${
                selectedCategory === category.service_category_code
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {IconComponent && <IconComponent className="w-4 h-4" />}
              <span className={isRTL ? 'text-right' : 'text-left'}>{displayName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});


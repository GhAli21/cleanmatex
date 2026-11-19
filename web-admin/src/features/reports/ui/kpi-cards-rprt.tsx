'use client';

import type { LucideIcon } from 'lucide-react';

/**
 *
 */
export interface KPICardData {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  trend?: { value: number; isPositive: boolean };
}

interface KPICardsProps {
  cards: KPICardData[];
}

/**
 *
 * @param root0
 * @param root0.cards
 */
export default function KPICards({ cards }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className="rounded-lg border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
              <div className={`rounded-lg p-2 ${card.bgColor}`}>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {typeof card.value === 'number'
                ? card.value.toLocaleString()
                : card.value}
            </div>
            {card.trend && (
              <div className="mt-1 flex items-center gap-1">
                <span
                  className={`text-xs font-medium ${
                    card.trend.isPositive ? 'text-success-text' : 'text-danger-text'
                  }`}
                >
                  {card.trend.isPositive ? '+' : ''}{card.trend.value}%
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

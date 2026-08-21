'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  buildOrderDetailsHref,
  type BuildOrderDetailsHrefParams,
} from '@lib/orders/order-details-navigation';

interface OrderDetailsLinkProps extends BuildOrderDetailsHrefParams {
  children: ReactNode;
  className?: string;
  title?: string;
  ariaLabel?: string;
  prefetch?: boolean;
}

/**
 * Reusable order-details link that keeps caller return state attached.
 */
export function OrderDetailsLink({
  children,
  className,
  title,
  ariaLabel,
  prefetch,
  ...hrefParams
}: OrderDetailsLinkProps) {
  const href = buildOrderDetailsHref(hrefParams);

  if (!href) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      href={href}
      className={className}
      title={title}
      aria-label={ariaLabel}
      prefetch={prefetch}
    >
      {children}
    </Link>
  );
}

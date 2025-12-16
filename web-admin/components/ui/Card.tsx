/**
 * Reusable Card Component
 * Container for content with optional header, footer, and padding variants
 */

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'bordered' | 'elevated';
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const variantClasses = {
  default: 'bg-white',
  bordered: 'bg-white border border-gray-200',
  elevated: 'bg-white shadow-lg',
};

export const Card: React.FC<CardProps> = ({
  padding = 'md',
  variant = 'bordered',
  className = '',
  children,
  ...props
}) => {
  const classes = `rounded-lg ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`;

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  actions,
  className = '',
  children,
  ...props
}) => {
  return (
    <div className={`border-b border-gray-200 pb-4 mb-4 ${className}`} {...props}>
      {(title || subtitle || actions) && (
        <div className="flex items-center justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export const CardFooter: React.FC<CardFooterProps> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div className={`border-t border-gray-200 pt-4 mt-4 ${className}`} {...props}>
      {children}
    </div>
  );
};

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardFooter.displayName = 'CardFooter';

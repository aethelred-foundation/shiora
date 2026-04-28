'use client';

import React from 'react';
import { Inbox } from 'lucide-react';

type EmptyStateSize = 'sm' | 'md' | 'lg';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  size?: EmptyStateSize;
  className?: string;
}

const SIZE_CONFIG: Record<
  EmptyStateSize,
  {
    container: string;
    iconWrapper: string;
    iconSize: string;
    title: string;
    description: string;
    button: string;
  }
> = {
  sm: {
    container: 'py-8 px-3',
    iconWrapper: 'w-10 h-10 mb-3',
    iconSize: 'w-5 h-5',
    title: 'text-sm font-semibold',
    description: 'text-xs max-w-xs',
    button: 'mt-4 px-4 py-2 text-xs',
  },
  md: {
    container: 'py-16 px-4',
    iconWrapper: 'w-16 h-16 mb-4',
    iconSize: 'w-7 h-7',
    title: 'text-lg font-semibold',
    description: 'text-sm max-w-sm',
    button: 'mt-6 px-5 py-2.5 text-sm',
  },
  lg: {
    container: 'py-24 px-6',
    iconWrapper: 'w-20 h-20 mb-6',
    iconSize: 'w-9 h-9',
    title: 'text-xl font-bold',
    description: 'text-base max-w-md',
    button: 'mt-8 px-6 py-3 text-sm',
  },
};

/**
 * Reusable empty state component for when no data is available.
 * Supports multiple sizes (sm, md, lg) with animated entrance.
 * Light-themed, matches the Shiora on Aethelred brand.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  className = '',
}: EmptyStateProps) {
  const config = SIZE_CONFIG[size];

  return (
    <div
      className={`flex flex-col items-center justify-center text-center animate-fade-in ${config.container} ${className}`}
    >
      <div
        className={`rounded-full bg-slate-100 flex items-center justify-center ${config.iconWrapper}`}
      >
        {icon || <Inbox className={`${config.iconSize} text-slate-400`} />}
      </div>
      <h3 className={`text-slate-900 mb-1 ${config.title}`}>{title}</h3>
      {description && <p className={`text-slate-500 ${config.description}`}>{description}</p>}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <button
              onClick={action.onClick}
              className={`inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${config.button}`}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className={`inline-flex items-center gap-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-medium transition-colors ${config.button}`}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

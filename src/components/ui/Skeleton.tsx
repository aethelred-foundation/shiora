import React from 'react';

/**
 * Animated skeleton line placeholder.
 * Uses the .skeleton CSS class defined in globals.css.
 */
export function SkeletonLine({
  width = '100%',
  height = '1rem',
  className = '',
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <div className={`skeleton rounded ${className}`} style={{ width, height }} aria-hidden="true" />
  );
}

/**
 * Skeleton text block — multiple lines for paragraph placeholders.
 */
export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton rounded h-3"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton avatar — circular placeholder for profile images.
 */
export function SkeletonAvatar({
  size = 40,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`skeleton rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton badge placeholder.
 */
export function SkeletonBadge({
  width = 64,
  className = '',
}: {
  width?: number;
  className?: string;
}) {
  return (
    <div
      className={`skeleton rounded-full h-5 ${className}`}
      style={{ width }}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton card placeholder matching MedicalCard dimensions.
 */
export function SkeletonCard({
  height = '12rem',
  className = '',
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={`skeleton rounded-2xl border border-slate-200 ${className}`}
      style={{ height }}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton metric card — simulates a HealthMetricCard.
 */
export function SkeletonMetric({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl p-5 ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="skeleton w-10 h-10 rounded-xl" />
        <div className="skeleton w-16 h-7 rounded" />
      </div>
      <div className="skeleton w-24 h-3 rounded mb-2" />
      <div className="skeleton w-16 h-7 rounded mb-2" />
      <div className="skeleton w-20 h-3 rounded" />
    </div>
  );
}

/**
 * Skeleton table with configurable row count.
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className = '',
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="skeleton rounded h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-4">
          {Array.from({ length: columns }).map((_, col) => (
            <div
              key={col}
              className="skeleton rounded h-8"
              style={{ flex: col === 0 ? 2 : 1, opacity: 1 - row * 0.1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton chart placeholder.
 */
export function SkeletonChart({
  height = 200,
  className = '',
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div className={`skeleton rounded-xl ${className}`} style={{ height }} aria-hidden="true" />
  );
}

/**
 * Skeleton stats row (for the 4-stat grid at top of pages).
 */
export function SkeletonStats({
  count = 4,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton rounded-2xl h-28 border border-slate-200" />
      ))}
    </div>
  );
}

import { SkeletonCard, SkeletonLine, SkeletonText } from '@/components/ui/Skeleton';

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Nav skeleton */}
      <div className="h-16 bg-white border-b border-slate-200" />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="skeleton rounded h-7 w-40 mb-2" />
          <div className="skeleton rounded h-4 w-72" />
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar skeleton */}
          <div className="lg:w-56 shrink-0 space-y-2 hidden lg:block">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="skeleton rounded-xl h-10" />
            ))}
          </div>

          {/* Content skeleton */}
          <div className="flex-1 space-y-6">
            <SkeletonCard height="10rem" />
            <SkeletonCard height="16rem" />
            <SkeletonCard height="12rem" />
          </div>
        </div>
      </div>
    </div>
  );
}

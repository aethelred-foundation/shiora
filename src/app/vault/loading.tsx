import { SkeletonStats, SkeletonChart, SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';

export default function VaultLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-16 bg-white border-b border-slate-200" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Hero skeleton */}
        <div className="flex items-center gap-4">
          <div className="skeleton w-12 h-12 rounded-2xl" />
          <div className="space-y-2">
            <div className="skeleton w-64 h-6 rounded" />
            <div className="skeleton w-96 h-4 rounded" />
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="skeleton rounded-xl h-10 w-full max-w-2xl" />

        {/* Stats */}
        <SkeletonStats count={4} />

        {/* Compartment grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} height="14rem" />
          ))}
        </div>

        {/* Activity feed skeleton */}
        <SkeletonTable rows={6} columns={3} />
      </div>
    </div>
  );
}

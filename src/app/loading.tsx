import { SkeletonStats, SkeletonChart, SkeletonCard } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Nav skeleton */}
      <div className="h-16 bg-white border-b border-slate-200" />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <SkeletonStats count={4} />
        <SkeletonChart height={300} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonCard height="16rem" />
          <SkeletonCard height="16rem" />
        </div>
      </div>
    </div>
  );
}

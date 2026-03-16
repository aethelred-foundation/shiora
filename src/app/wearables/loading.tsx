import { SkeletonStats, SkeletonChart, SkeletonCard } from '@/components/ui/Skeleton';

export default function WearablesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-16 bg-white border-b border-slate-200" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <SkeletonStats count={4} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} height="14rem" />
          ))}
        </div>
        <SkeletonChart height={220} />
      </div>
    </div>
  );
}

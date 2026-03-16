import { SkeletonStats, SkeletonChart, SkeletonCard } from '@/components/ui/Skeleton';

export default function TwinLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-16 bg-white border-b border-slate-200" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <SkeletonStats count={4} />
        <div className="skeleton rounded-xl h-10 w-full max-w-lg" />
        <SkeletonCard height="14rem" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonCard key={i} height="10rem" />
          ))}
        </div>
      </div>
    </div>
  );
}

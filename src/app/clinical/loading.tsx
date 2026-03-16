import { SkeletonStats, SkeletonChart, SkeletonCard } from '@/components/ui/Skeleton';

export default function ClinicalLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="skeleton rounded h-7 w-80 mb-2" />
        <div className="skeleton rounded h-4 w-96" />
      </div>

      {/* Stats row */}
      <SkeletonStats count={4} className="mb-8" />

      {/* Tab bar skeleton */}
      <div className="flex gap-2 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton rounded-lg h-9 w-28" />
        ))}
      </div>

      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts column */}
        <div className="space-y-3">
          <div className="skeleton rounded h-5 w-32 mb-4" />
          <SkeletonCard height="8rem" />
          <SkeletonCard height="8rem" />
          <SkeletonCard height="8rem" />
        </div>

        {/* Chart column */}
        <div>
          <div className="skeleton rounded h-5 w-40 mb-4" />
          <SkeletonChart height={360} />
        </div>
      </div>

      {/* Pathway overview */}
      <div className="mt-8">
        <div className="skeleton rounded h-5 w-48 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard height="10rem" />
          <SkeletonCard height="10rem" />
          <SkeletonCard height="10rem" />
        </div>
      </div>
    </div>
  );
}

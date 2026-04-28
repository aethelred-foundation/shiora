import {
  SkeletonStats,
  SkeletonChart,
  SkeletonCard,
  SkeletonTable,
} from '@/components/ui/Skeleton';

export default function GenomicsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-16 bg-white border-b border-slate-200" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Stats row */}
        <SkeletonStats count={4} />

        {/* Tabs placeholder */}
        <div className="skeleton rounded-xl h-10 w-full max-w-lg" />

        {/* Profile card */}
        <SkeletonCard height="18rem" />

        {/* Summary cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} height="8rem" />
          ))}
        </div>

        {/* Alert card */}
        <SkeletonCard height="6rem" />
      </div>
    </div>
  );
}

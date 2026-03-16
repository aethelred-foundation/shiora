import { SkeletonStats, SkeletonChart, SkeletonTable } from '@/components/ui/Skeleton';

export default function GovernanceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-16 bg-white border-b border-slate-200" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <SkeletonStats count={4} />
        <div className="skeleton rounded-2xl border border-slate-200 h-12" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton rounded-2xl border border-slate-200 h-56" />
          ))}
        </div>
      </div>
    </div>
  );
}

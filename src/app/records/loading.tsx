import { SkeletonStats, SkeletonChart, SkeletonTable } from '@/components/ui/Skeleton';

export default function RecordsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-16 bg-white border-b border-slate-200" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <SkeletonStats count={4} />
        <div className="skeleton rounded-2xl border border-slate-200 h-40" />
        <SkeletonTable rows={8} columns={5} />
      </div>
    </div>
  );
}

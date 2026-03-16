import { SkeletonStats, SkeletonChart, SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';

export default function ComplianceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-16 bg-white border-b border-slate-200" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <SkeletonStats count={5} />
        <SkeletonChart height={240} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonCard height="7rem" />
          <SkeletonCard height="7rem" />
          <SkeletonCard height="7rem" />
        </div>
        <SkeletonTable rows={8} columns={7} />
      </div>
    </div>
  );
}

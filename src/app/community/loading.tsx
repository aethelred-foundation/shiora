import { SkeletonStats, SkeletonChart } from '@/components/ui/Skeleton';

export default function CommunityLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-16 bg-white border-b border-slate-200" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div className="skeleton rounded-2xl border border-slate-200 h-20" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton rounded-full h-8 w-20" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton rounded-2xl border border-slate-200 h-48" />
          ))}
        </div>
      </div>
    </div>
  );
}

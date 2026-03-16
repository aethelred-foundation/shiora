export default function ChatLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-surface-100 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand-100" />
        <div className="w-48 h-4 bg-brand-100 rounded" />
        <div className="w-32 h-3 bg-brand-50 rounded" />
      </div>
    </div>
  );
}

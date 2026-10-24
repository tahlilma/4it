export default function Loading() {
  return (
    <div className="space-y-7" aria-busy="true" aria-label="Loading">
      <div className="space-y-2.5">
        <div className="shimmer h-9 w-72 max-w-full rounded-[10px]" />
        <div className="shimmer h-4 w-96 max-w-full rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shimmer h-[118px] rounded-[18px]" />
        ))}
      </div>
      <div className="shimmer h-80 rounded-[18px]" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-20">
      <div className="grid grid-cols-2 gap-x-3 gap-y-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

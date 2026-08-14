export default function Loading() {
  return (
    <div className="container-sr py-16">
      <div className="mb-8 h-10 w-64 animate-pulse rounded bg-sr-mist" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="surface h-64 animate-pulse bg-white/50" />
        ))}
      </div>
    </div>
  );
}

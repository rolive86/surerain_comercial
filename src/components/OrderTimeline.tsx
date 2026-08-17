export function orderStatusClass(status: string): string {
  switch (status) {
    case "confirmed":
      return "bg-sr-green text-white";
    case "completed":
      return "bg-sr-ink text-white";
    case "cancelled":
    case "rejected":
      return "bg-red-100 text-red-800";
    case "received":
      return "bg-sr-mist text-sr-green-dark";
    default:
      return "bg-white text-sr-ink border border-black/10";
  }
}

export function OrderTimeline({
  history,
}: {
  history: Array<{
    id: string;
    from_status: string | null;
    to_status: string;
    to_status_label: string;
    comment: string | null;
    created_at: string;
  }>;
}) {
  if (!history.length) {
    return <p className="mt-4 text-sm text-sr-ink/55">Sin historial de estados.</p>;
  }
  return (
    <ol className="mt-4 space-y-4 border-l-2 border-sr-green/25 pl-5">
      {history.map((h) => (
        <li key={h.id} className="relative text-sm">
          <span className="absolute -left-[1.55rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-sr-green" />
          <p className="font-semibold text-sr-ink">{h.to_status_label}</p>
          <p className="text-xs text-sr-ink/40">
            {new Date(h.created_at).toLocaleString("es-AR")}
          </p>
          {h.comment ? <p className="mt-1 text-sr-ink/60">{h.comment}</p> : null}
        </li>
      ))}
    </ol>
  );
}

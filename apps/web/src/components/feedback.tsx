export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <div className="state-card" aria-live="polite"><span className="spinner" />{label}</div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="state-card error" role="alert">
    <strong>Something went wrong</strong><p>{message}</p>
    {retry && <button className="button secondary" onClick={retry}>Try again</button>}
  </div>;
}

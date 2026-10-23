export default function ErrorBanner({ error }: { error?: string }) {
  if (!error) return null
  return <p className="alert alert-error">{error}</p>
}

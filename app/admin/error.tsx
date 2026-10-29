'use client'

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <p className="alert alert-error">{error.message || 'Something went wrong.'}</p>
      <button className="btn btn-primary" onClick={reset}>
        Go back
      </button>
    </div>
  )
}

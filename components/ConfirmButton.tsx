'use client'

import { useFormStatus } from 'react-dom'

// A submit button that asks first. Use inside a <form action={serverAction}>.
export default function ConfirmButton({
  message,
  className = 'btn btn-ghost btn-sm',
  children,
  name,
  value,
}: {
  message?: string
  className?: string
  children: React.ReactNode
  name?: string
  value?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (message && !confirm(message)) e.preventDefault()
      }}
    >
      {pending ? '…' : children}
    </button>
  )
}

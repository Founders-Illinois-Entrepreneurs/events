import { STATUS_LABEL, type EventStatus } from '@/lib/types'

const CLASS: Record<EventStatus, string> = {
  setup: 'chip chip-muted',
  open: 'chip chip-orange',
  closed: 'chip',
  revealed: 'chip chip-blue',
}

export default function StatusChip({ status }: { status: EventStatus }) {
  return <span className={CLASS[status]}>{STATUS_LABEL[status]}</span>
}

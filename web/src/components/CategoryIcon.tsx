import { Question, Tag } from '@phosphor-icons/react'
import { CATEGORY_ICONS } from '../lib/categoryIcons'

export function CategoryIcon({
  icon,
  color,
  size = 'md',
}: {
  icon?: string
  color?: string
  size?: 'sm' | 'md'
}) {
  const Component = (icon && CATEGORY_ICONS[icon]) || (icon ? Tag : Question)
  const box = size === 'sm' ? 'size-7 rounded-lg' : 'size-9 rounded-xl'
  return (
    <span
      className={`grid shrink-0 place-items-center ${box}`}
      style={{
        // Mix toward the foreground so user-picked colors stay legible in light and dark.
        backgroundColor: color
          ? `color-mix(in oklch, ${color} 14%, transparent)`
          : 'var(--surface-2)',
        color: color ? `color-mix(in oklch, ${color} 72%, var(--fg))` : 'var(--muted)',
      }}
    >
      <Component size={size === 'sm' ? 15 : 18} weight="duotone" />
    </span>
  )
}

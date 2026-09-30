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
        backgroundColor: color ? `${color}1a` : '#e7e5e4',
        color: color ?? '#a8a29e',
      }}
    >
      <Component size={size === 'sm' ? 15 : 18} weight="duotone" />
    </span>
  )
}

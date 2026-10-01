// Generated from brand/masters (valo-horizontal.svg, valo-symbol.svg). Edit the masters, not this file.
import { cn } from '../lib/cn'

/** Full lockup: symbol in brand blue, wordmark in the current text color. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 40 566.02 148"
      role="img"
      aria-label="Valo"
      className={cn('h-6 w-auto', className)}
    >
      <g fill="var(--logo)">
        <path d="M0 40L45 40L59.29 79.27L14.29 79.27ZM135.73 79.27L90.73 79.27L105.02 40L150.02 40ZM19.79 94.37L64.79 94.37L75.01 122.45L85.23 94.37L130.23 94.37L115.94 133.63L34.08 133.63ZM39.58 148.73L110.44 148.73L96.15 188L53.87 188Z" />
      </g>
      <g fill="currentColor">
        <path d="M198.62 88H230.55L250.02090362851015 141.5L269.49 88H301.42L265.02090362851015 188H235.02090362851015Z" />
        <path
          fillRule="evenodd"
          d="M354.02090362851015 88A50 50 0 1 1 354.02090362851015 188A50 50 0 1 1 354.02090362851015 88ZM354.02090362851015 116A22 22 0 1 0 354.02090362851015 160A22 22 0 1 0 354.02090362851015 116Z"
        />
        <path d="M376.02090362851015 88H404.02090362851015V188H376.02090362851015Z" />
        <path d="M418.02090362851015 40H446.02090362851015V188H418.02090362851015Z" />
        <path d="M496.02090362851015 88H536.0209036285102A30 30 0 0 1 566.0209036285102 118V158A30 30 0 0 1 536.0209036285102 188H496.02090362851015A30 30 0 0 1 466.02090362851015 158V118A30 30 0 0 1 496.02090362851015 88ZM500.02090362851015 116A6 6 0 0 0 494.02090362851015 122V154A6 6 0 0 0 500.02090362851015 160H532.0209036285102A6 6 0 0 0 538.0209036285102 154V122A6 6 0 0 0 532.0209036285102 116Z" />
      </g>
    </svg>
  )
}

/** Symbol only (the V in ledger rows). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" role="img" aria-label="Valo" className={cn('size-7', className)}>
      <g fill="var(--logo)">
        <path d="M28.66 30L88.26 30L107.18 82L47.59 82ZM208.41 82L148.82 82L167.74 30L227.34 30ZM54.87 102L114.46 102L128 139.2L141.54 102L201.13 102L182.21 154L73.79 154ZM81.07 174L174.93 174L156 226L100 226Z" />
      </g>
    </svg>
  )
}

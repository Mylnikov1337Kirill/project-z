type PixelPanelProps = {
  title?: string
  children: React.ReactNode
  className?: string
}

export function PixelPanel({ title, children, className = '' }: PixelPanelProps) {
  return (
    <section className={`pixel-panel ${className}`.trim()}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  )
}

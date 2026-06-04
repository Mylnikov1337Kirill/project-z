type MentorDialogProps = {
  eyebrow: string
  title: string
  children: React.ReactNode
}

export function MentorDialog({ eyebrow, title, children }: MentorDialogProps) {
  return (
    <aside className="mentor-dialog" aria-label="Диалог Z-бота">
      <div className="mentor-portrait" aria-hidden="true">
        <span className="mentor-eye mentor-eye-left" />
        <span className="mentor-eye mentor-eye-right" />
        <span className="mentor-mouth" />
      </div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <div className="dialog-copy">{children}</div>
      </div>
    </aside>
  )
}

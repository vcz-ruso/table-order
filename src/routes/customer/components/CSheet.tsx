import { useEffect, type ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** 고객용 바텀시트 스타일 모달 */
export function CSheet({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="c-overlay" onClick={onClose} role="presentation">
      <div className="c-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="c-sheet-header">
          <h3>{title}</h3>
          <button className="c-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

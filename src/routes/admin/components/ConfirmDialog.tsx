import { useState } from "react";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "확인",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리에 실패했습니다.");
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel} disabled={busy}>
            취소
          </button>
          <button
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? "처리 중…" : confirmLabel}
          </button>
        </>
      }
    >
      {error && <div className="form-error">{error}</div>}
      <p style={{ margin: 0, whiteSpace: "pre-line" }}>{message}</p>
    </Modal>
  );
}

import { Modal } from "./Modal.js";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-gray-300 mb-4">{message}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-sm rounded text-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          data-testid="confirm-btn"
          className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

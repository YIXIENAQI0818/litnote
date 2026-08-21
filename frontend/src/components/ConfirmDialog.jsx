// 卡片式确认弹窗：替换浏览器原生 window.confirm，垂直居中显示
export default function ConfirmDialog({
  title,
  message,
  confirmText = '删除',
  cancelText = '取消',
  onConfirm,
  onCancel,
}) {
  return (
    <div className="modal-backdrop modal-backdrop--center" onClick={onCancel}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onCancel}>
            ×
          </button>
        </div>
        <p className="confirm-message">{message}</p>
        <div className="form-actions">
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            {confirmText}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react';
import { supportApi } from '../../services/support/support.api.js';

const MAX_ATTACHMENTS = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default function SupportAttachmentPicker({
  ticketId,
  orderId,
  visibility = 'customer',
  disabled = false,
  onAttachmentsChange = () => {},
}) {
  const [files, setFiles] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  function selectFiles(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    setError('');
    setStatus('');
    if (attachments.length + files.length + selected.length > MAX_ATTACHMENTS) {
      setError('Có thể đính kèm tối đa 5 ảnh cho mỗi lần gửi.');
      return;
    }
    const unsupported = selected.find((file) => !MIME_TYPES.has(file.type) || file.size < 1 || file.size > MAX_BYTES);
    if (unsupported) {
      setError('Mỗi ảnh cần là JPEG, PNG hoặc WebP và không vượt quá 5 MB.');
      return;
    }
    setFiles((current) => [...current, ...selected.map((file) => ({ id: `${Date.now()}-${Math.random()}`, file }))]);
  }

  async function uploadSelected() {
    if (!files.length || busy) return;
    setBusy(true);
    setError('');
    setStatus('Đang tải ảnh riêng tư…');
    const remaining = [];
    let uploadedSoFar = [...attachments];
    try {
      for (let index = 0; index < files.length; index += 1) {
        const item = files[index];
        try {
          const response = await supportApi.createAttachmentUpload({
            purpose: 'ticket', mimeType: item.file.type, bytes: item.file.size, visibility,
            ...(ticketId ? { ticketId } : {}), ...(orderId ? { orderId } : {}),
          });
          const upload = response?.data;
          if (!upload?.id || !upload.uploadUrl || upload.method !== 'PUT' || !upload.headers) {
            throw new Error('Kho tệp chưa trả về thông tin tải lên hợp lệ.');
          }
          const putResponse = await fetch(upload.uploadUrl, {
            method: upload.method,
            headers: upload.headers,
            body: item.file,
            credentials: 'omit',
          });
          if (!putResponse.ok) throw new Error('Không thể tải ảnh lên kho riêng tư.');
          const finalized = await supportApi.finalizeAttachment(upload.id);
          if (finalized?.data?.state !== 'ready') throw new Error('Kho tệp chưa xác nhận ảnh đã tải lên.');
          uploadedSoFar = [...uploadedSoFar, { id: upload.id, name: item.file.name }];
          setAttachments(uploadedSoFar);
          onAttachmentsChange(uploadedSoFar.map((attachment) => attachment.id));
          setStatus(`Đã tải ${uploadedSoFar.length} ảnh riêng tư.`);
        } catch (uploadError) {
          remaining.push(...files.slice(index));
          throw uploadError;
        }
      }
      setFiles(remaining);
    } catch (uploadError) {
      setFiles(remaining);
      setError(uploadError.message || 'Chưa thể tải ảnh đính kèm.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  function removeAttachment(id) {
    const nextAttachments = attachments.filter((attachment) => attachment.id !== id);
    setAttachments(nextAttachments);
    onAttachmentsChange(nextAttachments.map((attachment) => attachment.id));
  }

  return <fieldset className="support-attachment-picker" disabled={disabled || busy}>
    <legend>Ảnh đính kèm (không bắt buộc)</legend>
    <p>Chọn tối đa 5 ảnh JPEG, PNG hoặc WebP, mỗi ảnh không quá 5 MB. Tệp được giữ riêng tư.</p>
    <label className="support-field">Chọn ảnh<input aria-label="Chọn ảnh đính kèm" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || busy || attachments.length >= MAX_ATTACHMENTS} onChange={selectFiles} /></label>
    {files.length > 0 && <ul className="support-attachment-list">{files.map((item) => <li key={item.id}><span>{item.file.name} · {Math.ceil(item.file.size / 1024)} KB · Chưa tải</span><button className="support-link-button" type="button" disabled={busy} onClick={() => setFiles((current) => current.filter((file) => file.id !== item.id))}>Bỏ ảnh</button></li>)}</ul>}
    {attachments.length > 0 && <ul className="support-attachment-list">{attachments.map((attachment) => <li key={attachment.id}><span>{attachment.name} · Đã tải</span><button className="support-link-button" type="button" disabled={busy} onClick={() => removeAttachment(attachment.id)}>Bỏ ảnh</button></li>)}</ul>}
    {files.length > 0 && <button className="support-button support-button--quiet" type="button" disabled={busy} onClick={uploadSelected}>{busy ? 'Đang tải…' : `Tải ${files.length} ảnh lên`}</button>}
    {status && <p className="support-feedback" role="status">{status}</p>}
    {error && <p className="support-feedback support-feedback--error" role="alert">{error}</p>}
  </fieldset>;
}

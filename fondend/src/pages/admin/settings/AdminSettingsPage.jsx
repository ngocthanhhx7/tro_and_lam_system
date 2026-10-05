import { useCallback, useEffect, useState } from 'react';
import { operationsApi } from '../../../services/operations/operationsApi.js';
import { businessSettingsDrafts, parseBusinessSettingsDrafts } from '../../../services/operations/businessSettingsForm.js';
import '../../../components/notifications/operations.css';

const JSON_FIELDS = [
  { key: 'shippingZones', label: 'Khu vực và phí giao hàng', kind: 'array', help: 'Danh sách JSON. Nhập cấu hình đã được chủ dự án xác nhận; chưa có cấu hình được phê duyệt sẽ hiển thị chờ xác nhận.' },
  { key: 'checkoutLimits', label: 'Giới hạn checkout', kind: 'object', help: 'Chỉ hỗ trợ maxPendingCodOrders là số nguyên dương. Nếu chưa có giá trị, COD checkout vẫn tắt; hệ thống không tự đặt mặc định.' },
  { key: 'supportWindows', label: 'Khung giờ hỗ trợ', kind: 'object', help: 'Đối tượng JSON theo giờ hỗ trợ do chủ dự án xác nhận.' },
];

function settingErrorMessage(error) {
  if (error.code === 'VERSION_CONFLICT') return 'Cấu hình đã được một quản trị viên khác cập nhật. Tải phiên bản mới trước khi lưu tiếp.';
  return error.message || 'Không thể tải hoặc lưu cấu hình.';
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [drafts, setDrafts] = useState(() => businessSettingsDrafts());
  const [dirtyKeys, setDirtyKeys] = useState(() => new Set());
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [versionConflict, setVersionConflict] = useState(false);
  const [success, setSuccess] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setVersionConflict(false);
    try {
      const response = await operationsApi.getBusinessSettings();
      setSettings(response.data);
      setDrafts(businessSettingsDrafts(response.data.values));
      setDirtyKeys(new Set());
    } catch (requestError) {
      setError(settingErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void loadSettings(); }, 0);
    return () => window.clearTimeout(initial);
  }, [loadSettings]);

  function updateDraft(key, value) {
    setDrafts((current) => ({ ...current, [key]: value }));
    setDirtyKeys((current) => new Set(current).add(key));
    setError('');
    setSuccess('');
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    setVersionConflict(false);
    try {
      const values = parseBusinessSettingsDrafts(drafts, dirtyKeys);
      const response = await operationsApi.updateBusinessSettings({
        values,
        expectedVersion: settings.version,
        reason: reason.trim(),
      });
      setSettings(response.data);
      setDrafts(businessSettingsDrafts(response.data.values));
      setDirtyKeys(new Set());
      setReason('');
      setSuccess('Cấu hình đã được lưu và ghi nhận vào audit.');
    } catch (requestError) {
      setError(settingErrorMessage(requestError));
      setVersionConflict(requestError.code === 'VERSION_CONFLICT');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="operations-page">
      <header className="operations-page__heading">
        <div><p className="operations-eyebrow">Quản trị · Cấu hình an toàn</p><h1>Cấu hình vận hành</h1><p>Chỉ chỉnh nhóm cấu hình nghiệp vụ được phép. Secret và địa chỉ provider không được hiển thị ở đây.</p></div>
        <button type="button" className="operations-button operations-button--quiet" onClick={loadSettings} disabled={loading || saving}>Tải lại</button>
      </header>

      {loading && <p role="status">Đang tải cấu hình…</p>}
      {error && <div className="operations-error" role="alert"><p>{error}</p>{versionConflict && <button type="button" onClick={loadSettings} disabled={loading || saving}>Tải cấu hình mới</button>}</div>}
      {success && <p className="operations-settings__success" role="status">{success}</p>}

      {!loading && settings && <form className="operations-settings" onSubmit={save}>
        <p className="operations-settings__version">Phiên bản hiện tại: {settings.version}. Mỗi lần lưu cần lý do và tạo audit.</p>

        <fieldset className="operations-settings__field">
          <legend>Bật thanh toán COD</legend>
          {settings.values.codEnabled === undefined && <p className="operations-settings__pending">Chưa cấu hình · đang chờ quyết định của chủ dự án.</p>}
          <label htmlFor="settings-cod">Trạng thái COD</label>
          <select id="settings-cod" value={drafts.codEnabled} onChange={(event) => updateDraft('codEnabled', event.target.value)} disabled={saving}>
            <option value="">Chọn bật hoặc tắt</option>
            <option value="true">Bật</option>
            <option value="false">Tắt</option>
          </select>
        </fieldset>

        {JSON_FIELDS.map(({ key, label, kind, help }) => (
          <fieldset className="operations-settings__field" key={key}>
            <legend>{label}</legend>
            {settings.values[key] === undefined && <p className="operations-settings__pending">Chưa cấu hình · đang chờ dữ liệu được chủ dự án xác nhận.</p>}
            {key === 'checkoutLimits' && settings.values.checkoutLimits?.maxPendingCodOrders === undefined
              && <p className="operations-settings__pending">Giới hạn COD chưa được cấu hình; checkout COD vẫn bị tắt.</p>}
            <label htmlFor={`settings-${key}`}>{kind === 'array' ? 'JSON danh sách' : 'JSON đối tượng'}</label>
            <textarea
              id={`settings-${key}`}
              value={drafts[key]}
              onChange={(event) => updateDraft(key, event.target.value)}
              aria-describedby={`settings-${key}-help`}
              rows={7}
              spellCheck="false"
              disabled={saving}
            />
            <small id={`settings-${key}-help`}>{help}</small>
          </fieldset>
        ))}

        <label className="operations-settings__reason" htmlFor="settings-reason">Lý do thay đổi
          <textarea id="settings-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} required disabled={saving} />
        </label>
        <div className="operations-settings__actions">
          <button type="submit" className="operations-button" disabled={saving || dirtyKeys.size === 0 || reason.trim().length === 0}>
            {saving ? 'Đang lưu…' : 'Lưu cấu hình'}
          </button>
          <span>{dirtyKeys.size ? `${dirtyKeys.size} nhóm thay đổi chưa lưu` : 'Chưa có thay đổi'}</span>
        </div>
      </form>}
    </section>
  );
}

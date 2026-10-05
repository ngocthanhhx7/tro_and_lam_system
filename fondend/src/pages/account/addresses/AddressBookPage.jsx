import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../services/httpClient.js';
import { accountApi } from '../../../services/account/account.api.js';
import './address-book.css';

const EMPTY_FORM = Object.freeze({
  label: '', recipientName: '', phone: '', line1: '', line2: '', ward: '', province: '',
  countryCode: 'VN', postalCode: '', formattedAddress: '', isDefault: false,
});

function messageFor(error) {
  if (error instanceof ApiError && error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để quản lý địa chỉ.';
  if (error instanceof ApiError && error.status === 403) return 'Tài khoản hiện không có quyền quản lý địa chỉ.';
  if (error instanceof ApiError && error.status === 404) return 'Địa chỉ không còn tồn tại. Hãy tải lại danh sách.';
  return error?.message || 'Chưa thể lưu thông tin. Hãy thử lại.';
}

function addressForm(address) {
  if (!address) return { ...EMPTY_FORM };
  return { ...EMPTY_FORM, ...address, location: address.location };
}

function AddressField({ label, name, value, onChange, required = false, autoComplete, multiline = false, maxLength, error, type = 'text' }) {
  const id = `address-${name}`;
  const common = { id, name, value: value ?? '', onChange, required, maxLength, autoComplete, 'aria-invalid': Boolean(error), ...(error ? { 'aria-describedby': `${id}-error` } : {}) };
  return <div className="address-field">
    <label htmlFor={id}><span>{label}{required ? ' *' : ''}</span></label>
    {multiline ? <textarea {...common} rows={3} /> : <input {...common} type={type} />}
    {error && <span className="address-field__error" id={`${id}-error`}>{error}</span>}
  </div>;
}

export default function AddressBookPage() {
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [keepLocation, setKeepLocation] = useState(false);
  const [capturedLocation, setCapturedLocation] = useState(null);

  const loadAddresses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await accountApi.listAddresses();
      setAddresses(response.data);
    } catch (loadError) {
      setError(messageFor(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    accountApi.listAddresses().then((response) => {
      if (active) setAddresses(response.data);
    }).catch((loadError) => {
      if (active) setError(messageFor(loadError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  function updateField(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    if (fieldErrors[name]) setFieldErrors((current) => ({ ...current, [name]: undefined }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setCapturedLocation(null);
    setKeepLocation(false);
    setGeoError('');
  }

  function editAddress(address) {
    setEditingId(address.id);
    setForm(addressForm(address));
    setCapturedLocation(address.location || null);
    setKeepLocation(Boolean(address.location));
    setGeoError('');
    setNotice('');
    document.getElementById('address-form-title')?.focus();
  }

  async function suggestAddress() {
    setGeoError('');
    setNotice('');
    if (!navigator.geolocation) {
      setGeoError('Thiết bị này không hỗ trợ định vị. Bạn có thể điền địa chỉ bên dưới.');
      return;
    }
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setGeoError('Định vị cần kết nối HTTPS. Bạn vẫn có thể nhập địa chỉ thủ công.');
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
        source: 'browser',
      };
      setCapturedLocation(location);
      try {
        const response = await accountApi.reverseGeocode({ lat: location.lat, lng: location.lng });
        const suggestion = response.data.suggestedAddress;
        setForm((current) => ({
          ...current,
          ...suggestion,
          countryCode: 'VN',
        }));
        setNotice('Địa chỉ gợi ý đã được điền. Hãy kiểm tra số nhà, người nhận và số điện thoại trước khi lưu.');
      } catch (geoRequestError) {
        setGeoError(`${messageFor(geoRequestError)} Nhập địa chỉ thủ công vẫn dùng được.`);
      } finally {
        setGeoBusy(false);
      }
    }, (geoPositionError) => {
      const text = geoPositionError.code === geoPositionError.PERMISSION_DENIED
        ? 'Bạn đã từ chối quyền vị trí. Hãy nhập địa chỉ thủ công bên dưới.'
        : geoPositionError.code === geoPositionError.TIMEOUT
          ? 'Thiết bị chưa trả vị trí kịp thời. Hãy thử lại hoặc nhập địa chỉ thủ công.'
          : 'Không lấy được vị trí hiện tại. Hãy nhập địa chỉ thủ công.';
      setGeoError(text);
      setGeoBusy(false);
    }, { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 });
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFieldErrors({});
    setNotice('');
    const payload = {
      label: form.label,
      recipientName: form.recipientName,
      phone: form.phone,
      line1: form.line1,
      line2: form.line2,
      ward: form.ward,
      province: form.province,
      countryCode: 'VN',
      postalCode: form.postalCode,
      formattedAddress: form.formattedAddress,
      isDefault: form.isDefault,
      ...(keepLocation && capturedLocation ? { location: capturedLocation } : {}),
    };
    try {
      if (editingId) {
        await accountApi.updateAddress(editingId, { ...payload, expectedVersion: form.version });
        setNotice('Đã cập nhật địa chỉ.');
      } else {
        await accountApi.createAddress(payload);
        setNotice('Đã lưu địa chỉ.');
      }
      resetForm();
      await loadAddresses();
    } catch (saveError) {
      setError(messageFor(saveError));
      if (Array.isArray(saveError.details)) {
        setFieldErrors(Object.fromEntries(saveError.details.map((detail) => [detail.field, detail.message])));
      }
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(address) {
    setPendingId(address.id);
    setError('');
    try {
      await accountApi.setDefaultAddress(address.id, address.version);
      setNotice('Đã đổi địa chỉ mặc định.');
      await loadAddresses();
    } catch (defaultError) {
      setError(messageFor(defaultError));
    } finally {
      setPendingId(null);
    }
  }

  async function deleteAddress(address) {
    setPendingId(address.id);
    setError('');
    try {
      await accountApi.deleteAddress(address.id, address.version);
      setConfirmDeleteId(null);
      if (editingId === address.id) resetForm();
      setNotice('Đã xóa địa chỉ. Nếu đó là địa chỉ mặc định, hệ thống đã chọn địa chỉ còn lại phù hợp.');
      await loadAddresses();
    } catch (deleteError) {
      setError(messageFor(deleteError));
    } finally {
      setPendingId(null);
    }
  }

  return <section className="address-book">
    <div className="address-book__intro">
      <p className="address-book__eyebrow">Tài khoản của bạn</p>
      <h1>Địa chỉ nhận hàng</h1>
      <p>Thêm địa chỉ linh hoạt. Phường/xã và tỉnh/thành có thể để trống nếu bạn chưa rõ tên hiện hành.</p>
    </div>

    {error && <div className="address-alert address-alert--error" role="alert">{error} <button type="button" onClick={loadAddresses}>Tải lại</button></div>}
    {notice && <p className="address-alert address-alert--success" role="status">{notice}</p>}

    <div className="address-book__grid">
      <section className="address-card" aria-labelledby="address-form-title">
        <h2 id="address-form-title" tabIndex="-1">{editingId ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới'}</h2>
        <p className="address-card__hint">Các trường có dấu * cần được điền để giao hàng.</p>
        <button className="address-button address-button--soft" type="button" onClick={suggestAddress} disabled={geoBusy}>
          {geoBusy ? 'Đang lấy gợi ý…' : 'Dùng vị trí hiện tại'}
        </button>
        <p className="address-card__hint">Chỉ lấy vị trí sau khi bạn bấm nút. Tọa độ được gửi tới dịch vụ gợi ý địa chỉ; địa chỉ trả về chỉ là gợi ý cần bạn kiểm tra. Nếu dịch vụ không hoạt động, hãy nhập tay.</p>
        {geoError && <p className="address-alert address-alert--error" role="status">{geoError}</p>}
        <form className="address-form" onSubmit={submit}>
          <AddressField label="Tên gợi nhớ" name="label" value={form.label} onChange={updateField} maxLength={80} error={fieldErrors.label} />
          <AddressField label="Người nhận" name="recipientName" value={form.recipientName} onChange={updateField} required autoComplete="name" maxLength={100} error={fieldErrors.recipientName} />
          <AddressField label="Số điện thoại" name="phone" value={form.phone} onChange={updateField} required autoComplete="tel" maxLength={30} type="tel" error={fieldErrors.phone} />
          <AddressField label="Số nhà, đường" name="line1" value={form.line1} onChange={updateField} required autoComplete="address-line1" maxLength={200} error={fieldErrors.line1} />
          <AddressField label="Căn hộ, tầng, tòa nhà (không bắt buộc)" name="line2" value={form.line2} onChange={updateField} autoComplete="address-line2" maxLength={200} error={fieldErrors.line2} />
          <div className="address-form__pair">
            <AddressField label="Phường/xã (không bắt buộc)" name="ward" value={form.ward} onChange={updateField} autoComplete="address-level3" maxLength={100} error={fieldErrors.ward} />
            <AddressField label="Tỉnh/thành (không bắt buộc)" name="province" value={form.province} onChange={updateField} autoComplete="address-level1" maxLength={100} error={fieldErrors.province} />
          </div>
          <AddressField label="Địa chỉ đầy đủ để giao hàng" name="formattedAddress" value={form.formattedAddress} onChange={updateField} required autoComplete="street-address" multiline maxLength={500} error={fieldErrors.formattedAddress} />
          {capturedLocation && (editingId && form.location
            ? <p className="address-card__hint">Địa chỉ này đang có tọa độ đã lưu; chỉnh sửa các trường khác sẽ giữ lại tọa độ đó.</p>
            : <label className="address-consent">
              <input type="checkbox" checked={keepLocation} onChange={(event) => setKeepLocation(event.target.checked)} />
              <span>Lưu tọa độ gần đúng cùng địa chỉ này. Tọa độ không bắt buộc để đặt hàng.</span>
            </label>)}
          <label className="address-consent">
            <input name="isDefault" type="checkbox" checked={Boolean(form.isDefault)} onChange={updateField} />
            <span>Đặt làm địa chỉ mặc định</span>
          </label>
          {notice && <p className="address-alert address-alert--success" role="status">{notice}</p>}
          <div className="address-form__actions">
            <button className="address-button" type="submit" disabled={saving || geoBusy}>{saving ? 'Đang lưu…' : 'Lưu địa chỉ'}</button>
            {editingId && <button className="address-button address-button--soft" type="button" onClick={resetForm} disabled={saving}>Hủy chỉnh sửa</button>}
          </div>
        </form>
      </section>

      <section className="address-list" aria-labelledby="saved-addresses-title" aria-busy={loading}>
        <div className="address-list__heading"><h2 id="saved-addresses-title">Địa chỉ đã lưu</h2><span>{addresses.length}/20</span></div>
        {loading && <p role="status">Đang tải danh sách địa chỉ…</p>}
        {!loading && addresses.length === 0 && <div className="address-empty"><h3>Chưa có địa chỉ nào</h3><p>Thêm địa chỉ bên trái để lần sau điền thông tin nhanh hơn.</p></div>}
        {!loading && addresses.map((address) => <article className="address-saved" key={address.id}>
          <div className="address-saved__heading">
            <h3>{address.label || address.recipientName}</h3>
            {address.isDefault && <span className="address-badge">Mặc định</span>}
          </div>
          <p><strong>{address.recipientName}</strong> · <a href={`tel:${address.phone}`}>{address.phone}</a></p>
          <p>{address.line1}{address.line2 ? `, ${address.line2}` : ''}</p>
          <p>{[address.ward, address.province].filter(Boolean).join(', ') || address.formattedAddress}</p>
          <div className="address-saved__actions">
            <button className="address-button address-button--soft" type="button" onClick={() => editAddress(address)}>Chỉnh sửa</button>
            {!address.isDefault && <button className="address-button address-button--soft" type="button" onClick={() => makeDefault(address)} disabled={pendingId === address.id}>Đặt mặc định</button>}
            {confirmDeleteId === address.id
              ? <><span className="address-confirm">Xóa địa chỉ này?</span><button className="address-button address-button--danger" type="button" onClick={() => deleteAddress(address)} disabled={pendingId === address.id}>{pendingId === address.id ? 'Đang xóa…' : 'Xác nhận xóa'}</button><button className="address-button address-button--soft" type="button" onClick={() => setConfirmDeleteId(null)}>Giữ lại</button></>
              : <button className="address-button address-button--soft" type="button" onClick={() => setConfirmDeleteId(address.id)}>Xóa</button>}
          </div>
        </article>)}
      </section>
    </div>
  </section>;
}

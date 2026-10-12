export default function ShippingZoneEditor({ value, onChange, disabled }) {
  let zones = [];
  try { zones = value ? JSON.parse(value) : []; } catch { /* A stored setting is validated by the API. */ }
  const commit = rows => onChange(JSON.stringify(rows, null, 2));
  const update = (index, fields) => commit(zones.map((zone, position) => position === index ? { ...zone, ...fields } : zone));
  return <div className="shipping-zone-editor">
    <p>Đặt phí chung cho toàn quốc, hoặc thêm mức phí riêng theo tỉnh/thành. Mức phí theo tỉnh được ưu tiên hơn phí chung.</p>
    {zones.map((zone, index) => <div className="shipping-zone-row" key={zone.id}>
      <strong>Vùng giao hàng {index + 1}</strong>
      <label>Phạm vi giao hàng<select value={zone.provinceNames.includes('*') ? 'all' : 'provinces'} disabled={disabled}
        onChange={event => update(index, { provinceNames: event.target.value === 'all' ? ['*'] : [] })}>
        <option value="all">Toàn quốc</option><option value="provinces">Theo tỉnh / thành phố</option>
      </select></label>
      {!zone.provinceNames.includes('*') && <label>Tỉnh / thành phố<textarea rows={2} value={zone.provinceNames.join(',')} disabled={disabled} required
        placeholder="Hà Nội, Hải Phòng…" onChange={event => update(index, { provinceNames: event.target.value.split(',') })} />
        <small>Nhập tên tỉnh/thành, ngăn cách bằng dấu phẩy.</small>
      </label>}
      <label>Phí giao hàng (VND)<input type="number" min="0" step="1" value={zone.feeVnd} disabled={disabled} required
        onChange={event => update(index, { feeVnd: event.target.value === '' ? '' : Number(event.target.value) })} />
        <small>Nhập 0 nếu miễn phí giao hàng.</small>
      </label>
      <button type="button" className="operations-button operations-button--quiet" disabled={disabled} onClick={() => commit(zones.filter((_, position) => position !== index))}>Xóa vùng này</button>
    </div>)}
    {!zones.length && <p className="operations-settings__pending">Chưa có vùng giao hàng. Thêm vùng và nhập phí để khách có thể đặt hàng.</p>}
    <button type="button" className="operations-button operations-button--quiet" disabled={disabled}
      onClick={() => commit([...zones, { id: `zone-${crypto.randomUUID()}`, provinceNames: [], feeVnd: '' }])}>+ Thêm vùng giao hàng</button>
  </div>;
}

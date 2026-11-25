import './chu-dau-map.css';

const place = 'Công ty cổ phần gốm sứ Chu Đậu Hải Dương';
const address = 'Chu Đậu, Thái Tân, Hải Phòng';
const query = encodeURIComponent(`X7PX+F6M ${place}, ${address}`);
const mapsUrl = `https://www.google.com/maps?q=${query}&ftid=0x31359d2aa255283b:0x6f35509fd5aab95b`;

export default function ChuDauMap({ compact = false }) {
  const frame = <iframe title={`Bản đồ ${place}`} src={`${mapsUrl}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />;
  if (compact) return <details className="footer-location">
    <summary><span>Xem bản đồ <small>{address}</small></span><strong className="map-toggle" aria-hidden="true" /></summary>
    {frame}
    <a href={mapsUrl} target="_blank" rel="noopener noreferrer">Chỉ đường trên Google Maps ↗</a>
  </details>;
  return <section className="chu-dau-map" aria-label="Bản đồ gốm Chu Đậu">
    <div className="chu-dau-map__info">
      <h3>{place}</h3>
      <p>{address}</p>
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer">Mở Google Maps ↗</a>
    </div>
    {frame}
  </section>;
}

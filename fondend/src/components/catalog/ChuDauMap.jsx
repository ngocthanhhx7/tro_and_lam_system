import './chu-dau-map.css';

const place = 'Công ty cổ phần gốm sứ Chu Đậu Hải Dương';
const address = 'Chu Đậu, Thái Tân, Hải Phòng';
const query = encodeURIComponent(`X7PX+F6M ${place}, ${address}`);
const mapsUrl = `https://www.google.com/maps?q=${query}&ftid=0x31359d2aa255283b:0x6f35509fd5aab95b`;

export default function ChuDauMap({ compact = false }) {
  return <section className={compact ? 'chu-dau-map chu-dau-map--compact' : 'chu-dau-map'} aria-label="Bản đồ gốm Chu Đậu">
    <div className="chu-dau-map__info">
      <h3>{place}</h3>
      <p>{address}</p>
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer">Mở Google Maps <span aria-hidden="true">↗</span></a>
    </div>
    <iframe title={`Bản đồ ${place}`} src={`${mapsUrl}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
  </section>;
}

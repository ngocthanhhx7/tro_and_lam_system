import { Link } from 'react-router-dom';
import { PageMotif, SectionHeading } from './NfcPageParts.jsx';
import './nfc-company.css';

const mapQuery = 'X7PX+F6M Công ty cổ phần gốm sứ Chu Đậu Hải Dương, Chu Đậu, Thái Tân, Hải Phòng';
const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&ftid=0x31359d2aa255283b:0x6f35509fd5aab95b`;
const mapEmbedUrl = `${mapUrl}&output=embed&hl=vi`;

export default function NfcCompanySection({ prefix }) {
  return <section className="gn-section gn-pattern nfc-company" aria-labelledby={`${prefix}-company-title`}>
    <PageMotif motif="bamboo" placement="care-bamboo" opacity={.08} />
    <div className="gn-container">
      <SectionHeading id={`${prefix}-company-title`}>5. Địa chỉ công ty</SectionHeading>
      <div className="nfc-company-grid">
        <div className="nfc-company-info">
          <p className="nfc-company-eyebrow">Gốm Chu Đậu</p>
          <h3>Công ty cổ phần gốm sứ Chu Đậu Hải Dương</h3>
          <address>Chu Đậu, Thái Tân, Hải Phòng</address>
          <p className="nfc-company-code">Mã vị trí: <span>X7PX+F6M</span></p>
          <a className="nfc-company-map-link" href={mapUrl} target="_blank" rel="noopener noreferrer">Mở trên Google Maps<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 21s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg></a>
        </div>
        <div className="nfc-company-map">
          <iframe src={mapEmbedUrl} title="Bản đồ Công ty cổ phần gốm sứ Chu Đậu Hải Dương" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
        </div>
      </div>
      <div className="gn-signoff"><Link to="/" aria-label="TRO & LAM – Trang chủ"><img src="/images/logo/brand-160.webp" srcSet="/images/logo/brand-160.webp 160w, /images/logo/brand-320.webp 320w" sizes="128px" alt="Logo TRO & LAM" width="128" height="128" loading="lazy" /></Link><span>Gốm Chu Đậu · Văn hóa Việt</span></div>
    </div>
  </section>;
}

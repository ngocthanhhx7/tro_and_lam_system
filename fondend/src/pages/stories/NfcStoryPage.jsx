import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { LocaleLinks, StoryContent } from '../../components/story/StoryContent.jsx';
import { ApiError } from '../../services/httpClient.js';
import { getNfcStory } from '../../services/content/content.service.js';

export default function NfcStoryPage() {
  const { publicId } = useParams();
  const [searchParams] = useSearchParams();
  const locale = searchParams.get('locale') === 'en' ? 'en' : 'vi';
  const [result, setResult] = useState({ status: 'loading' });
  const requestKey = `${publicId}:${locale}`;

  useEffect(() => {
    const controller = new AbortController();
    getNfcStory(publicId, locale, { signal: controller.signal })
      .then((response) => setResult({ key: requestKey, status: 'ready', value: response.data }))
      .catch((error) => {
        if (error.name !== 'AbortError') setResult({ key: requestKey, status: 'error', error });
      });
    return () => controller.abort();
  }, [publicId, locale, requestKey]);

  const viewResult = result.key === requestKey ? result : { status: 'loading' };
  const basePath = `/nfc/${encodeURIComponent(publicId)}`;
  if (viewResult.status === 'loading') return <div className="story-page"><p role="status">Đang tải câu chuyện…</p></div>;
  if (viewResult.status === 'error') {
    const revoked = viewResult.error instanceof ApiError && viewResult.error.status === 410 && viewResult.error.code === 'NFC_REVOKED';
    const missing = viewResult.error instanceof ApiError && viewResult.error.status === 404;
    return <div className="story-page"><section className="story-state" role="alert">
      <h1>{revoked ? 'Thẻ NFC đã ngừng hoạt động' : missing ? 'Chưa có câu chuyện công khai' : 'Không tải được nội dung'}</h1>
      <p>{revoked ? 'Mã NFC này đã được thu hồi.' : missing ? 'Câu chuyện chưa được xuất bản ở ngôn ngữ đã chọn hoặc mã không còn hợp lệ.' : 'Vui lòng thử lại sau.'}</p>
      <Link to="/">Về trang chủ</Link>
    </section></div>;
  }

  const { product, story } = viewResult.value;
  return <div className="story-page story-page-nfc">
    <LocaleLinks locale={locale} basePath={basePath} />
    {product?.slug && <aside className="story-product">
      <p className="story-eyebrow">Sản phẩm liên quan</p>
      <h2>{product.name}</h2>
      {product.line && <p>{product.line === 'lifestyle' ? 'Lifestyle' : product.line === 'diplomacy' ? 'Diplomacy' : ''}</p>}
      <Link to={`/san-pham/${encodeURIComponent(product.slug)}`}>Xem sản phẩm</Link>
    </aside>}
    <StoryContent story={story} label="Nội dung NFC" />
    <p className="notice">Mã NFC mở nội dung câu chuyện và không xác nhận nguồn gốc hay tính xác thực của sản phẩm.</p>
  </div>;
}

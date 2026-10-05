import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { LocaleLinks } from '../../components/story/StoryContent.jsx';
import { ApiError } from '../../services/httpClient.js';
import { getPage } from '../../services/content/content.service.js';
import { PublicPageContent } from './StoryPage.jsx';

export default function PublishedPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const locale = searchParams.get('locale') === 'en' ? 'en' : 'vi';
  const [state, setState] = useState({ status: 'loading' });
  const requestKey = `${slug}:${locale}`;
  useEffect(() => {
    const controller = new AbortController();
    getPage(slug, locale, { signal: controller.signal })
      .then((response) => setState({ key: requestKey, status: 'ready', page: response.data }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ key: requestKey, status: 'error', error }); });
    return () => controller.abort();
  }, [slug, locale, requestKey]);

  const viewState = state.key === requestKey ? state : { status: 'loading' };
  return <div className="story-page">
    <LocaleLinks locale={locale} basePath={`/trang/${encodeURIComponent(slug)}`} />
    {viewState.status === 'loading' && <p role="status">Đang tải trang…</p>}
    {viewState.status === 'error' && <section className="story-state" role="alert">
      <h1>{viewState.error instanceof ApiError && viewState.error.status === 404 ? 'Không tìm thấy trang công khai' : 'Không tải được trang'}</h1>
      <p>{viewState.error instanceof ApiError && viewState.error.status === 404 ? 'Trang chưa được xuất bản ở ngôn ngữ đã chọn.' : 'Vui lòng thử lại sau.'}</p>
    </section>}
    {viewState.status === 'ready' && <PublicPageContent page={viewState.page} />}
  </div>;
}

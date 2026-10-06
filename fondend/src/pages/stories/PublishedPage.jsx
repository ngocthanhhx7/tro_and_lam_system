import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { LocaleLinks } from '../../components/story/StoryContent.jsx';
import { ApiError } from '../../services/httpClient.js';
import { getPage } from '../../services/content/content.service.js';
import { setPageIndexability, setPageMetadata, setPublishedContentMetadata } from '../../utils/pageMetadata.js';
import { PublicPageContent } from './StoryPage.jsx';

export default function PublishedPage({ pageSlug, fallback }) {
  const { slug: routeSlug } = useParams();
  const slug = pageSlug || routeSlug;
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
  const publishedPage = viewState.status === 'ready' ? viewState.page : null;
  const usesEditorialFallback = Boolean(fallback && locale === 'vi'
    && viewState.status === 'error' && viewState.error instanceof ApiError && viewState.error.status === 404);

  useEffect(() => {
    if (publishedPage) {
      setPageIndexability(true);
      setPublishedContentMetadata({ title: publishedPage.title, blocks: publishedPage.blocks, locale });
    } else if (usesEditorialFallback) {
      setPageIndexability(true);
    } else if (viewState.status === 'error' && !usesEditorialFallback) {
      setPageIndexability(false);
      const missing = viewState.error instanceof ApiError && viewState.error.status === 404;
      setPageMetadata({
        title: missing ? 'Trang chưa công khai | TRO & LAM' : 'Không tải được trang | TRO & LAM',
        description: missing ? 'Trang này chưa được xuất bản bằng ngôn ngữ đã chọn.' : 'TRO & LAM hiện chưa thể tải trang này.',
      });
    }
  }, [publishedPage, viewState.status, viewState.error, usesEditorialFallback, locale]);

  if (fallback && locale === 'vi' && viewState.status === 'error' && viewState.error instanceof ApiError && viewState.error.status === 404) return fallback;
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

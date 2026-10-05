import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ContentBlocks, LocaleLinks, StoryContent } from '../../components/story/StoryContent.jsx';
import { ApiError } from '../../services/httpClient.js';
import { getStory } from '../../services/content/content.service.js';

export default function StoryPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const locale = searchParams.get('locale') === 'en' ? 'en' : 'vi';
  const [state, setState] = useState({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${slug}:${locale}:${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();
    getStory(slug, locale, { signal: controller.signal })
      .then((response) => setState({ key: requestKey, status: 'ready', story: response.data }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ key: requestKey, status: 'error', error });
      });
    return () => controller.abort();
  }, [slug, locale, reloadKey, requestKey]);

  const viewState = state.key === requestKey ? state : { status: 'loading' };

  const basePath = `/cau-chuyen/${encodeURIComponent(slug)}`;
  return <div className="story-page">
    <LocaleLinks locale={locale} basePath={basePath} />
    {viewState.status === 'loading' && <p role="status">Đang tải câu chuyện…</p>}
    {viewState.status === 'error' && <section className="story-state" role="alert">
      <h1>{viewState.error instanceof ApiError && viewState.error.status === 404 ? 'Chưa có nội dung ở ngôn ngữ này' : 'Không tải được câu chuyện'}</h1>
      <p>{viewState.error instanceof ApiError && viewState.error.status === 404 ? 'Nội dung này chưa được xuất bản cho lựa chọn ngôn ngữ hiện tại.' : 'Vui lòng thử lại sau.'}</p>
      <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Tải lại</button>
    </section>}
    {viewState.status === 'ready' && <StoryContent story={viewState.story} />}
  </div>;
}

export function PublicPageContent({ page }) {
  return <article className="story-content">
    <h1>{page.title}</h1>
    <ContentBlocks blocks={page.blocks} />
  </article>;
}

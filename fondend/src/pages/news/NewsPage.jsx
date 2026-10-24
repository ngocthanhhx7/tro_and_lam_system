import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import Icon from '../../components/catalog/Icon.jsx';
import DecorativeMotif from '../../components/catalog/DecorativeMotif.jsx';
import NewsCard, { NewsMeta } from './NewsCard.jsx';
import { formatNewsDate, getNewsArticle, getNewsCategory, newsArticles, newsCategories, newsMilestones, normalizeNewsSearch } from './newsData.js';
import './news.css';

const feature = getNewsArticle('gom-chu-dau-4-lan-lien-tiep-dat-thuong-hieu-quoc-gia');
const spotlights = ['gom-chu-dau-gap-nghe-thuat-ikebana', 'gom-chu-dau-hanh-trinh-gan-600-nam', 'nghe-nhan-tiep-noi-tinh-hoa-gom-chu-dau'].map(getNewsArticle);
const sortedArticles = [...newsArticles].sort((first, second) => (first.editorialOrder ?? Number.MAX_SAFE_INTEGER) - (second.editorialOrder ?? Number.MAX_SAFE_INTEGER) || second.date.localeCompare(first.date));

export default function NewsPage() {
  const [params, setParams] = useSearchParams();
  const { hash, key: locationKey } = useLocation();
  const category = getNewsCategory(params.get('chu-de')).id;
  const query = params.get('q') || '';
  const filterKey = `${category}:${query}`;
  const [pagination, setPagination] = useState({ key: '', count: 6 });
  const visibleCount = pagination.key === filterKey ? pagination.count : 6;
  const search = normalizeNewsSearch(query.trim());
  const results = sortedArticles.filter((article) => (category === 'all' || article.category === category)
    && normalizeNewsSearch(`${article.title} ${article.excerpt} ${article.kind || ''} ${getNewsCategory(article.category).label}`).includes(search));

  useEffect(() => {
    if (hash !== '#bai-viet') return;
    const frame = window.requestAnimationFrame(() => document.getElementById('bai-viet')?.scrollIntoView({ behavior: 'instant' }));
    return () => window.cancelAnimationFrame(frame);
  }, [hash, locationKey]);

  function updateFilter(key, value) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value && value !== 'all') next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: key === 'q', preventScrollReset: true });
  }
  function resetFilters() {
    setParams((current) => { const next = new URLSearchParams(current); next.delete('q'); next.delete('chu-de'); return next; }, { preventScrollReset: true });
  }

  return <div className="news-page">
    <section className="news-masthead">
      <DecorativeMotif motif="lotus" placement="top-right" size="220px" opacity={.075} breakpoint="tablet" />
      <div className="news-container"><h1>Tin tức &amp; <em>câu chuyện tiếp nối.</em></h1>
        <p className="news-masthead__intro">Dấu mốc của một dòng gốm. Nhịp sống của một làng nghề. Và những điều Tro &amp; Lam đang kể cùng bạn.</p>
      </div>
    </section>

    <section className="news-container news-feature" aria-label="Tin tiêu điểm">
      <Link className="news-feature__main" to={`/tin-tuc/${feature.slug}`}>
        <img src={feature.image} alt={feature.imageAlt} width="1200" height="800" fetchPriority="high" />
        <span className="news-feature__tag">TIN TIÊU ĐIỂM</span>
        <div className="news-feature__copy"><NewsMeta article={feature} /><h2>{feature.title}</h2><span className="news-read-link">Khám phá câu chuyện <Icon name="arrow" size={18} /></span></div>
      </Link>
      <aside className="news-feature__side"><div className="news-feature__side-heading"><span className="news-eyebrow">ĐÁNG CHÚ Ý</span><span aria-hidden="true">01 — 03</span></div>
        {spotlights.map((article) => <Link className="news-spotlight" to={`/tin-tuc/${article.slug}`} key={article.slug}><div><span className="news-category">{getNewsCategory(article.category).label}</span><h2>{article.title}</h2><time dateTime={article.date}>{formatNewsDate(article.date)}</time></div><img src={article.image} alt={article.imageAlt} width="140" height="140" loading="lazy" /></Link>)}
      </aside>
    </section>

    <section className="news-library news-container" id="bai-viet" aria-labelledby="news-library-title">
      <div className="news-section-heading"><div><p className="news-eyebrow">GHI CHÉP &amp; ĐIỂM TIN</p><h2 id="news-library-title">Những điều đang được kể.</h2></div><span className="news-section-heading__note">Từ làng gốm đến đời sống hôm nay</span></div>
      <div className="news-toolbar">
        <div className="news-filters" role="group" aria-label="Lọc tin theo chủ đề">{newsCategories.map((item) => <button type="button" className={item.id === category ? 'is-active' : ''} aria-pressed={item.id === category} aria-controls="news-results" key={item.id} onClick={() => updateFilter('chu-de', item.id)}>{item.label}<span>{item.id === 'all' ? newsArticles.length : newsArticles.filter((article) => article.category === item.id).length}</span></button>)}</div>
        <div className="news-search"><Icon name="search" size={18} /><label className="visually-hidden" htmlFor="news-search">Tìm bài viết</label><input id="news-search" type="search" placeholder="Tìm bài viết…" value={query} maxLength="120" onChange={(event) => updateFilter('q', event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); updateFilter('q', ''); } }} />{query && <button type="button" aria-label="Xóa từ khóa tìm kiếm" onClick={() => updateFilter('q', '')}><Icon name="close" size={16} /></button>}</div>
      </div>
      <p className="news-results-count" role="status" aria-live="polite">{results.length} bài viết{category !== 'all' ? ` · ${getNewsCategory(category).label}` : ''}{query.trim() ? ` cho “${query.trim()}”` : ''}</p>
      <div id="news-results">
        {results.length > 0 ? <div className="news-grid">{results.slice(0, visibleCount).map((article) => <NewsCard article={article} key={article.slug} />)}</div>
          : <div className="news-empty"><h3>Chưa tìm thấy bài viết phù hợp.</h3><p>Thử một từ khóa khác hoặc xem lại tất cả chủ đề.</p><button className="news-button" type="button" onClick={resetFilters}>Xem tất cả bài viết</button></div>}
      </div>
      {results.length > visibleCount && <div className="news-load-more"><button type="button" className="news-button" onClick={() => setPagination({ key: filterKey, count: visibleCount + 6 })}>Xem thêm bài viết <span>({results.length - visibleCount})</span><Icon name="arrow" size={17} /></button></div>}
    </section>

    <section className="news-milestones" aria-labelledby="news-milestones-title"><div className="news-container"><p className="news-eyebrow">NHỮNG DẤU MỐC ĐƯỢC GÌN GIỮ</p><h2 id="news-milestones-title">Một hành trình, nhiều dấu ấn.</h2><ol>{newsMilestones.map((milestone) => <li key={milestone.year}><Link to={`/tin-tuc/${milestone.slug}`}><span className="news-milestone-year">{milestone.year}</span><h3>{milestone.title}</h3><p>{milestone.description}</p><span className="news-milestone-link">Đọc câu chuyện <Icon name="arrow" size={16} /></span></Link></li>)}</ol></div></section>

    <section className="news-container news-brand-note" aria-labelledby="news-brand-title"><div><p className="news-eyebrow">TỪ TRO &amp; LAM</p><h2 id="news-brand-title">Di sản, trong một cách kể mới.</h2><p>Cùng khám phá sản phẩm, dòng gốm đời sống và gốm quà tặng, cùng những câu chuyện gốm được Tro &amp; Lam biên tập.</p><Link className="news-read-link" to="/tin-tuc?chu-de=tro-va-lam#bai-viet">Đọc những ghi chép từ Tro &amp; Lam <Icon name="arrow" size={18} /></Link></div><img src="/assets/editorial/diplomacy-slides/binh-giot-ngoc.webp" alt="Phối cảnh Bình Giọt Ngọc trong bộ tư liệu Tro & Lam" width="1122" height="1402" loading="lazy" /></section>
  </div>;
}

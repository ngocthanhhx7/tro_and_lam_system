import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../../components/catalog/Icon.jsx';
import NotFoundPage from '../NotFoundPage.jsx';
import { setPageIndexability, setPageMetadata } from '../../utils/pageMetadata.js';
import NewsCard, { NewsMeta } from './NewsCard.jsx';
import { formatNewsDate, getNewsArticle, getNewsCategory, newsArticles } from './newsData.js';
import './news.css';

export default function NewsArticlePage() {
  const { slug } = useParams();
  const article = getNewsArticle(slug);
  useEffect(() => {
    if (!article) {
      setPageIndexability(false);
      setPageMetadata({ title: '404 — Không tìm thấy bài viết | TRO & LAM', description: 'Bài viết không tồn tại. Quay lại trang Tin tức để khám phá các câu chuyện khác từ Tro & Lam.' });
      return;
    }
    setPageMetadata({ title: `${article.title} | Tin tức | TRO & LAM`, description: article.excerpt });
  }, [article]);
  if (!article) return <NotFoundPage />;
  const related = newsArticles.filter((item) => item.slug !== slug).sort((first, second) => Number(second.category === article.category) - Number(first.category === article.category)).slice(0, 3);

  return <div className="news-page news-article-page">
    <article className="news-container news-article">
      <div className="news-article__heading">
        <div className="news-article__topline"><Link className="news-category" to={`/tin-tuc?chu-de=${article.category}#bai-viet`}>{getNewsCategory(article.category).label}</Link><NewsMeta article={article} detailed /></div>
        <h1>{article.title}</h1><p className="news-article__lede">{article.excerpt}</p><p className="news-article__byline">{article.sources ? 'Biên tập: Tro & Lam' : article.source ? `Tro & Lam tổng hợp từ nguồn ${article.source.label}` : 'Ban biên tập Tro & Lam'}</p>
      </div>
      <div className="news-article__layout">
        <div className="news-article__main">
          <figure className="news-article__image"><img src={article.image} alt={article.imageAlt} width="1200" height="800" fetchPriority="high" /><figcaption>{article.imageCaption}{article.imageSourceUrl && <> <a href={article.imageSourceUrl} target="_blank" rel="noreferrer">Nguồn ảnh</a></>}{article.imageCreditUrl && <> <a href={article.imageCreditUrl} target="_blank" rel="noreferrer">Ảnh gốc &amp; giấy phép</a></>}</figcaption></figure>
          <div className="news-article__body">
            {article.introduction && <p className="news-article__introduction">{article.introduction}</p>}
            {article.sections.map((section, index) => <section id={`noi-dung-${index + 1}`} key={section.heading}>
              <h2>{section.heading}</h2>{(section.paragraphs || [section.text]).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
              {section.image && <figure className="news-article__inline-image"><img src={section.image.src} alt={section.image.alt} width="1000" height="667" loading="lazy" /><figcaption>{section.image.caption} <a href={section.image.sourceUrl} target="_blank" rel="noreferrer">Nguồn ảnh</a></figcaption></figure>}
            </section>)}
            {article.sources ? <aside className="news-source-note"><h2>Nguồn tham khảo</h2><ul>{article.sources.map((source) => <li key={source.url}><span>{source.label} · <time dateTime={source.date}>{formatNewsDate(source.date)}</time></span><a href={source.url} target="_blank" rel="noreferrer">{source.title}<Icon name="arrow" size={17} /></a></li>)}</ul></aside>
              : article.source && <aside className="news-source-note"><span className="news-eyebrow">ĐỌC TỪ NGUỒN</span><p>Bài tóm lược dựa trên thông tin đã công bố. Ngày hiển thị là ngày nguồn đăng bài.</p><a href={article.source.url} target="_blank" rel="noreferrer">Xem bài gốc trên {article.source.label} <Icon name="arrow" size={17} /></a></aside>}
            {article.action && <Link className="news-button" to={article.action.href}>{article.action.label}<Icon name="arrow" size={18} /></Link>}
            {article.references?.map((reference) => <p className="news-article__reference" key={reference.href}><Link to={reference.href}>{reference.label}</Link></p>)}
            <div className="news-article__back"><Link to="/tin-tuc"><Icon name="arrow" size={18} />Trở về Tin tức</Link><span>TRO &amp; LAM · Giữ nét xưa. Chạm hôm nay.</span></div>
          </div>
        </div>
        <aside className="news-article__sidebar" aria-label="Khám phá bài viết">
          <nav className="news-article__toc" aria-labelledby="news-toc-title"><h2 id="news-toc-title">Trong bài viết</h2><ol>{article.sections.map((section, index) => <li key={section.heading}><a href={`#noi-dung-${index + 1}`}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{section.heading}</a></li>)}</ol></nav>
          <section className="news-related" aria-labelledby="news-related-title"><h2 id="news-related-title">Đọc tiếp cùng Tro &amp; Lam.</h2><div className="news-grid">{related.map((item) => <NewsCard key={item.slug} article={item} compact />)}</div><Link className="news-read-link" to="/tin-tuc">Tất cả bài viết <Icon name="arrow" size={17} /></Link></section>
        </aside>
      </div>
    </article>
  </div>;
}

import { Link } from 'react-router-dom';
import Icon from '../../components/catalog/Icon.jsx';
import { staticImageProps } from '../../services/catalog/staticImage.js';
import { formatNewsDate, getNewsCategory } from './newsData.js';

export function NewsMeta({ article, detailed = false }) {
  return <div className="news-meta"><time dateTime={article.date}>{detailed ? `${article.source ? 'Nguồn đăng' : 'Biên tập'}: ` : ''}{formatNewsDate(article.date)}</time><span aria-hidden="true">·</span><span>{article.source ? 'Gốm Chu Đậu' : article.kind}</span></div>;
}

export default function NewsCard({ article, compact = false }) {
  return <article className={`news-card${compact ? ' news-card--compact' : ''}`}><Link className="news-card__link" to={`/tin-tuc/${article.slug}`} aria-label={`Đọc bài: ${article.title}`}>
    <div className="news-card__image"><img {...staticImageProps(article.image, { width: 640, sizes: compact ? '(min-width: 1000px) 88px, (max-width: 639px) calc(100vw - 40px), 45vw' : '(max-width: 639px) calc(100vw - 40px), (max-width: 1000px) 45vw, 30vw' })} alt={article.imageAlt} loading="lazy" width="640" height="420" /></div>
    <div className="news-card__copy"><span className="news-category">{getNewsCategory(article.category).label}</span><h3>{article.title}</h3><p>{article.excerpt}</p><NewsMeta article={article} /><span className="news-read-link">Đọc bài viết <Icon name="arrow" size={17} /></span></div>
  </Link></article>;
}

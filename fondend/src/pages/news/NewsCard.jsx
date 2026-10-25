import { Link } from 'react-router-dom';
import Icon from '../../components/catalog/Icon.jsx';
import { newsImageProps, newsImageSizes } from '../../services/catalog/newsImage.js';
import { formatNewsDate, getNewsCategory } from './newsData.js';

export function NewsMeta({ article, detailed = false }) {
  return <div className="news-meta"><time dateTime={article.date}>{detailed ? `${article.source ? 'Nguồn đăng' : 'Biên tập'}: ` : ''}{formatNewsDate(article.date)}</time><span aria-hidden="true">·</span><span>{article.source ? article.source.label : article.kind}</span></div>;
}

export default function NewsCard({ article, compact = false }) {
  return <article className={`news-card${compact ? ' news-card--compact' : ''}`}><Link className="news-card__link" to={`/tin-tuc/${article.slug}`} aria-label={`Đọc bài: ${article.title}`}>
    <div className="news-card__image"><img {...newsImageProps(article.image, { width: compact ? 320 : 640, sizes: compact ? newsImageSizes.related : newsImageSizes.card })} alt={article.imageAlt} loading="lazy" /></div>
    <div className="news-card__copy"><span className="news-category">{getNewsCategory(article.category).label}</span><h3>{article.title}</h3><p>{article.excerpt}</p><NewsMeta article={article} /><span className="news-read-link">Đọc bài viết <Icon name="arrow" size={17} /></span></div>
  </Link></article>;
}

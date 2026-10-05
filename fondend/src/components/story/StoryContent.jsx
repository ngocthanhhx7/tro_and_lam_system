import './story.css';

export function ContentBlocks({ blocks = [] }) {
  return blocks.map((block, index) => {
    const key = `${block.type}-${index}`;
    if (block.type === 'heading') return <h2 key={key}>{block.text}</h2>;
    if (block.type === 'quote') return <blockquote key={key}>{block.text}</blockquote>;
    if (block.type === 'list') return <ul key={key}>{block.items?.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}>{item}</li>)}</ul>;
    if (block.type === 'image') return <figure className="story-media" key={key}><img src={block.url} alt={block.alt} loading="lazy" />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
    if (block.type === 'link') {
      const external = block.url.startsWith('https:');
      return <p key={key}><a href={block.url} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{block.text}</a></p>;
    }
    return <p key={key}>{block.text}</p>;
  });
}

export function StoryContent({ story, label = 'Câu chuyện' }) {
  return <article className="story-content">
    <p className="story-eyebrow">{label} · {story.locale === 'vi' ? 'Tiếng Việt' : 'English'}</p>
    <h1>{story.title}</h1>
    {story.origin && <p className="story-origin">{story.origin}</p>}
    {story.artisan && <p>{story.artisan}</p>}
    {story.motifs?.length > 0 && <section aria-labelledby="story-motifs"><h2 id="story-motifs">Hoa văn được ghi nhận</h2><ul>{story.motifs.map((motif, index) => <li key={`${motif}-${index}`}>{motif}</li>)}</ul></section>}
    {story.media?.map((media, index) => <figure className="story-media" key={`${media.url}-${index}`}><img src={media.url} alt={media.alt} loading="lazy" />{media.caption && <figcaption>{media.caption}</figcaption>}</figure>)}
    {story.sections?.map((section, index) => <section className="story-section" key={`${section.heading || 'section'}-${index}`}>
      {section.heading && <h2>{section.heading}</h2>}
      <ContentBlocks blocks={section.body} />
    </section>)}
  </article>;
}

export function LocaleLinks({ locale, basePath }) {
  return <nav className="story-locales" aria-label="Ngôn ngữ">
    <a aria-current={locale === 'vi' ? 'page' : undefined} href={`${basePath}?locale=vi`}>Tiếng Việt</a>
    <a aria-current={locale === 'en' ? 'page' : undefined} href={`${basePath}?locale=en`}>English</a>
  </nav>;
}

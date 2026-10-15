import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { safeAssistantHref } from '../../services/assistant/safeAssistantHref.js';

export default function AssistantMarkdown({ content, sources = [] }) {
  const allowedLinks = new Set(sources.map(source => safeAssistantHref(source.href)).filter(Boolean));
  return <div className="assistant-markdown"><ReactMarkdown
    remarkPlugins={[remarkGfm]}
    skipHtml
    allowedElements={['p', 'strong', 'em', 'del', 'ul', 'ol', 'li', 'br', 'blockquote', 'code', 'pre', 'h3', 'h4', 'a', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th']}
    components={{
      a: ({ href, children }) => allowedLinks.has(href) ? <Link to={href}>{children}</Link> : <span>{children}</span>,
      table: ({ children }) => <div className="assistant-markdown__table"><table>{children}</table></div>,
    }}
  >{content}</ReactMarkdown></div>;
}

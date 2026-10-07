import { useId, useState } from 'react';
import { requestAssistantHandoff, sendAssistantMessage } from '../../services/assistant/assistant.api.js';
import './assistant.css';
import Icon from '../catalog/Icon.jsx';

const PRIVACY_NOTE = 'Trước khi xử lý, TRO & LAM sẽ ẩn các thông tin nhận dạng thường gặp. Câu hỏi về sản phẩm và câu chuyện có thể được gửi tới dịch vụ Gemini. Không gửi mật khẩu, mã xác nhận hay thông tin thanh toán.';

function safeSourceHref(href) {
  return typeof href === 'string' && href.startsWith('/') && !href.startsWith('//') && !href.includes('\\')
    ? href : null;
}

export function AssistantWidget() {
  const panelId = useId();
  const consentId = useId();
  const transcriptId = useId();
  const contactConsentId = useId();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState('');
  const [draft, setDraft] = useState('');
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffPending, setHandoffPending] = useState(false);
  const [handoffError, setHandoffError] = useState('');
  const [handoffDone, setHandoffDone] = useState('');
  const [shareTranscript, setShareTranscript] = useState(false);
  const [contactConsent, setContactConsent] = useState(false);
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });

  async function submitMessage(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !consent || pending) return;
    setPending(true);
    setError('');
    setDraft('');
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', content: message }]);
    try {
      const result = await sendAssistantMessage({ conversationId, message });
      if (!result?.conversationId || typeof result.reply !== 'string') throw new Error('INVALID_RESPONSE');
      setConversationId(result.conversationId);
      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.reply,
        sources: Array.isArray(result.sources) ? result.sources : [],
        handoffSuggested: result.handoffSuggested === true,
      }]);
    } catch (requestError) {
      setError(requestError?.status === 429
        ? 'Bạn đang gửi câu hỏi quá nhanh. Vui lòng đợi một chút rồi thử lại.'
        : 'Không gửi được câu hỏi lúc này. Nội dung vẫn ở trong cửa sổ này; bạn có thể thử lại hoặc liên hệ nhân viên.');
      setDraft(message);
    } finally {
      setPending(false);
    }
  }

  async function submitHandoff(event) {
    event.preventDefault();
    if (!conversationId || !contactConsent || handoffPending) return;
    setHandoffPending(true);
    setHandoffError('');
    setHandoffDone('');
    try {
      const result = await requestAssistantHandoff({
        conversationId,
        shareTranscript,
        contact: {
          name: contact.name.trim(),
          email: contact.email.trim(),
          ...(contact.phone.trim() ? { phone: contact.phone.trim() } : {}),
        },
      });
      setHandoffDone(result?.reference ? `Đã tiếp nhận yêu cầu. Mã tham chiếu: ${result.reference}` : 'Đã tiếp nhận yêu cầu.');
      setHandoffOpen(false);
    } catch {
      setHandoffError('Chưa thể chuyển yêu cầu cho nhân viên. Hãy thử lại sau.');
    } finally {
      setHandoffPending(false);
    }
  }

  return (
    <div className="assistant-widget">
      {open && (
        <section
          id={panelId}
          className="assistant-widget__panel"
          role="dialog"
          aria-labelledby={`${panelId}-title`}
          aria-modal="false"
          onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
        >
          <header className="assistant-widget__header">
            <div>
              <p className="assistant-widget__eyebrow">TRO &amp; LAM</p>
              <h2 id={`${panelId}-title`}>Trợ lý tư vấn</h2>
            </div>
            <button type="button" className="assistant-widget__close" aria-label="Đóng trợ lý" onClick={() => setOpen(false)}>×</button>
          </header>

          <p className="assistant-widget__privacy">{PRIVACY_NOTE}</p>
          <div className="assistant-widget__messages" role="log" aria-live="polite" aria-busy={pending}>
            {messages.length === 0 && (
              <p className="assistant-widget__welcome">Bạn muốn tìm hiểu sản phẩm hay câu chuyện đã được TRO &amp; LAM công bố?</p>
            )}
            {messages.map((item) => (
              <article className={`assistant-widget__message assistant-widget__message--${item.role}`} key={item.id}>
                <p>{item.content}</p>
                {item.sources?.length > 0 && (
                  <ul className="assistant-widget__sources" aria-label="Nguồn thông tin công khai">
                    {item.sources.map((source) => {
                      const href = safeSourceHref(source.href);
                      if (!href) return null;
                      return <li key={`${source.type}-${source.id}`}><a href={href}>{source.title || 'Nguồn thông tin'}</a></li>;
                    })}
                  </ul>
                )}
              </article>
            ))}
            {pending && <p className="assistant-widget__status" role="status">Đang tìm thông tin công khai…</p>}
          </div>

          {error && <p className="assistant-widget__error" role="alert">{error}</p>}
          {handoffDone && <p className="assistant-widget__success" role="status">{handoffDone}</p>}

          <form className="assistant-widget__form" onSubmit={submitMessage}>
            <label htmlFor={`${panelId}-message`}>Câu hỏi</label>
            <textarea
              id={`${panelId}-message`}
              rows="2"
              maxLength="5000"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Hỏi về sản phẩm hoặc câu chuyện đã công bố"
              required
            />
            <label className="assistant-widget__check" htmlFor={consentId}>
              <input id={consentId} type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>Tôi đồng ý gửi câu hỏi đã được ẩn thông tin nhận dạng để trợ lý xử lý.</span>
            </label>
            <button className="assistant-widget__send" type="submit" disabled={!consent || !draft.trim() || pending}>
              {pending ? 'Đang gửi…' : 'Gửi câu hỏi'}
            </button>
          </form>

          {conversationId && (
            <div className="assistant-widget__handoff">
              {!handoffOpen ? (
                <button type="button" className="assistant-widget__link-button" onClick={() => setHandoffOpen(true)}>
                  {messages.some((item) => item.handoffSuggested) ? 'Chuyển sang nhân viên hỗ trợ' : 'Nhờ nhân viên tư vấn'}
                </button>
              ) : (
                <form className="assistant-widget__handoff-form" onSubmit={submitHandoff}>
                  <h3>Nhân viên liên hệ với bạn</h3>
                  <label htmlFor={`${panelId}-name`}>Họ tên</label>
                  <input id={`${panelId}-name`} autoComplete="name" maxLength="120" required value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} />
                  <label htmlFor={`${panelId}-email`}>Email</label>
                  <input id={`${panelId}-email`} type="email" autoComplete="email" maxLength="254" required value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} />
                  <label htmlFor={`${panelId}-phone`}>Số điện thoại <span>(không bắt buộc)</span></label>
                  <input id={`${panelId}-phone`} type="tel" autoComplete="tel" maxLength="30" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} />
                  <label className="assistant-widget__check" htmlFor={transcriptId}>
                    <input id={transcriptId} type="checkbox" checked={shareTranscript} onChange={(event) => setShareTranscript(event.target.checked)} />
                    <span>Cho phép chia sẻ bản hội thoại đã được ẩn thông tin nhận dạng cho nhân viên.</span>
                  </label>
                  <label className="assistant-widget__check" htmlFor={contactConsentId}>
                    <input id={contactConsentId} type="checkbox" checked={contactConsent} onChange={(event) => setContactConsent(event.target.checked)} required />
                    <span>Đồng ý dùng thông tin liên hệ này để phản hồi yêu cầu.</span>
                  </label>
                  {handoffError && <p className="assistant-widget__error" role="alert">{handoffError}</p>}
                  <div className="assistant-widget__actions">
                    <button type="button" className="assistant-widget__link-button" onClick={() => setHandoffOpen(false)}>Quay lại</button>
                    <button className="assistant-widget__send" type="submit" disabled={!contactConsent || handoffPending}>
                      {handoffPending ? 'Đang gửi…' : 'Gửi yêu cầu'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>
      )}
      <button
        type="button"
        className="assistant-widget__launcher"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Đóng trợ lý tư vấn' : 'Mở trợ lý tư vấn'}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={open ? 'close' : 'message'} size={24} />
      </button>
    </div>
  );
}

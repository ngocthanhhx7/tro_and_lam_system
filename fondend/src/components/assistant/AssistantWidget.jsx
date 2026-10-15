import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAssistantUsage, requestAssistantHandoff, sendAssistantMessage } from '../../services/assistant/assistant.api.js';
import { useAuth } from '../../contexts/auth.context.js';
import { safeAssistantHref } from '../../services/assistant/safeAssistantHref.js';
import Icon from '../catalog/Icon.jsx';
import './assistant.css';
const MASCOT = '/images/mascot/men-160.webp';
const AssistantMarkdown = lazy(() => import('./AssistantMarkdown.jsx'));
const SUGGESTIONS = ['Gợi ý một món quà', 'Phí giao hàng thế nào?', 'Theo dõi đơn hàng'];
export function AssistantWidget() {
  const { user } = useAuth();
  return <AssistantConversation key={user?.id || user?._id || 'guest'} />;
}
function AssistantConversation() {
  const panelId = useId(); const transcriptId = useId(); const contactConsentId = useId();
  const launcher = useRef(null); const composer = useRef(null); const scroll = useRef(null);
  const followMessages = useRef(true); const openedBefore = useRef(false); const busy = useRef(false); const requestController = useRef(null);
  const messageSequence = useRef(0);
  const [open, setOpen] = useState(false); const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(''); const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false); const [usage, setUsage] = useState(null);
  const [usageError, setUsageError] = useState(false); const [error, setError] = useState('');
  const [handoffOpen, setHandoffOpen] = useState(false); const [handoffPending, setHandoffPending] = useState(false);
  const [handoffError, setHandoffError] = useState(''); const [handoffDone, setHandoffDone] = useState('');
  const [shareTranscript, setShareTranscript] = useState(false); const [contactConsent, setContactConsent] = useState(false);
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const acceptUsage = useCallback(value => setUsage(current => {
    if (!value || !Number.isInteger(value.used) || !Number.isInteger(value.remaining)) return current;
    if (current && (current.resetsAt > value.resetsAt || (current.resetsAt === value.resetsAt && current.used > value.used))) return current;
    return value;
  }), []);
  const exhausted = usage?.remaining === 0;
  useEffect(() => () => requestController.current?.abort(), []);
  useEffect(() => {
    if (open) composer.current?.focus({ preventScroll: true });
    else if (openedBefore.current) launcher.current?.focus({ preventScroll: true });
    openedBefore.current = open;
  }, [open]);
  useEffect(() => { if (followMessages.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [messages, pending, open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    getAssistantUsage({ signal: controller.signal }).then(value => { acceptUsage(value); setUsageError(false); })
      .catch(requestError => { if (requestError.name !== 'AbortError') setUsageError(true); });
    return () => controller.abort();
  }, [open, acceptUsage]);
  useEffect(() => {
    if (!open || !usage?.resetsAt) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      getAssistantUsage({ signal: controller.signal }).then(acceptUsage).catch(() => {});
    }, Math.max(1000, Date.parse(usage.resetsAt) - Date.now() + 1000));
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, usage?.resetsAt, acceptUsage]);
  async function sendMessage(text) {
    const message = text.trim(); if (!message || busy.current || exhausted || (!usage && !usageError)) return;
    busy.current = true; setPending(true); setError(''); setDraft(''); followMessages.current = true;
    const messageId = `user-${messageSequence.current++}`;
    setMessages(current => [...current.filter(item => !(item.failed && item.content === message)), { id: messageId, role: 'user', content: message }]);
    const controller = new AbortController(); requestController.current = controller;
    try {
      const result = await sendAssistantMessage({ conversationId, message }, { signal: controller.signal });
      if (!result?.conversationId || typeof result.reply !== 'string') throw new Error('INVALID_RESPONSE');
      setConversationId(result.conversationId);
      if (result.usage) { acceptUsage(result.usage); setUsageError(false); }
      const replyId = `assistant-${messageSequence.current++}`;
      setMessages(current => [...current, { id: replyId, role: 'assistant', content: result.reply,
        sources: Array.isArray(result.sources) ? result.sources : [], handoffSuggested: result.handoffSuggested === true }]);
    } catch (requestError) {
      if (requestError.name === 'AbortError') return;
      setMessages(current => current.map(item => item.id === messageId ? { ...item, failed: true } : item)); setDraft(message);
      setError(requestError.code === 'AI_DAILY_LIMIT'
        ? 'Bạn đã dùng hết 10 câu hỏi hôm nay. Men hẹn bạn sau 00:00 nhé 🌙 Bạn vẫn có thể liên hệ nhân viên.'
        : requestError.status === 429 ? 'Men cần nghỉ một nhịp. Bạn đợi chút rồi gửi lại nhé.'
          : 'Men chưa nhận được câu trả lời. Câu hỏi vẫn ở ô nhập để bạn thử lại nhé.');
      try { acceptUsage(await getAssistantUsage({ signal: controller.signal })); } catch { /* Server remains the quota authority. */ }
    } finally { busy.current = false; setPending(false); }
  }
  async function submitHandoff(event) {
    event.preventDefault(); if (!conversationId || !contactConsent || handoffPending) return;
    setHandoffPending(true); setHandoffError(''); setHandoffDone('');
    try {
      const result = await requestAssistantHandoff({ conversationId, shareTranscript, contact: {
        name: contact.name.trim(), email: contact.email.trim(), ...(contact.phone.trim() ? { phone: contact.phone.trim() } : {}),
      } });
      setHandoffDone(result?.reference ? `Đã tiếp nhận yêu cầu. Mã tham chiếu: ${result.reference}` : 'Đã tiếp nhận yêu cầu.'); setHandoffOpen(false);
    } catch { setHandoffError('Chưa thể chuyển yêu cầu. Bạn thử lại hoặc dùng trang Liên hệ nhé.'); }
    finally { setHandoffPending(false); }
  }
  return <div className="assistant-widget">
    {open && <section id={panelId} className="assistant-widget__panel" role="dialog" aria-modal="false" aria-labelledby={`${panelId}-title`}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); } }}>
      <header className="assistant-widget__header">
        <img className="assistant-widget__avatar" src={MASCOT} alt="" width="52" height="52" />
        <div><p className="assistant-widget__eyebrow">TRO &amp; LAM · TRỢ LÝ GỐM</p><h2 id={`${panelId}-title`}>Men đây, bạn ơi! 🌿</h2></div>
        <button type="button" className="assistant-widget__close" aria-label="Đóng trợ lý" onClick={() => setOpen(false)}><Icon name="close" size={18} /></button>
      </header>
      <div className="assistant-widget__usage"><span>Hôm nay</span><strong aria-live="polite">{usage ? `${usage.remaining}/${usage.limit} lượt còn lại` : '10 câu hỏi / ngày'}</strong></div>
      <div ref={scroll} className="assistant-widget__messages" role="log" aria-label="Cuộc trò chuyện với Men" aria-live="polite"
        onScroll={event => { const el = event.currentTarget; followMessages.current = el.scrollHeight - el.clientHeight - el.scrollTop < 80; }}>
        {!messages.length && <div className="assistant-widget__welcome">
          <p>Bạn cần chọn gốm hay hỗ trợ đặt hàng? Mình giúp bạn nhé ✨</p>
          <div className="assistant-widget__suggestions">{SUGGESTIONS.map(text => <button type="button" key={text} disabled={pending || exhausted || (!usage && !usageError)} onClick={() => sendMessage(text)}>{text}<Icon name="arrow" size={15} /></button>)}</div>
        </div>}
        {messages.map(item => <article key={item.id} className={`assistant-widget__message assistant-widget__message--${item.role}`}>
          {item.role === 'assistant' ? <><span className="assistant-widget__speaker">MEN · TRO &amp; LAM</span><Suspense fallback={<p>{item.content}</p>}><AssistantMarkdown content={item.content} sources={item.sources} /></Suspense></> : <p>{item.content}</p>}
          {item.failed && <small className="assistant-widget__failed">Chưa gửi thành công</small>}
          {!!item.sources?.length && <div className="assistant-widget__sources" aria-label="Xem thêm">{item.sources.map(source => {
            const href = safeAssistantHref(source.href); return href ? <Link key={`${source.type}-${source.id}`} to={href}>{source.title || 'Xem thêm'}<Icon name="arrow" size={13} /></Link> : null;
          })}</div>}
        </article>)}
        {pending && <p className="assistant-widget__status" role="status"><img src={MASCOT} alt="" width="28" height="28" />Men đang tìm thông tin cho bạn…</p>}
      </div>
      {error && <p className="assistant-widget__error" role="alert">{error}</p>}
      {handoffDone && <p className="assistant-widget__success" role="status">{handoffDone}</p>}
      {exhausted ? <div className="assistant-widget__limit"><strong>Hẹn bạn ngày mai nhé 🌙</strong><p>10 lượt mới sẽ có lúc 00:00 (giờ Việt Nam).</p><Link to="/lien-he">Liên hệ nhân viên <Icon name="arrow" size={15} /></Link></div>
        : <form className="assistant-widget__form" onSubmit={event => { event.preventDefault(); void sendMessage(draft); }}>
          <label className="visually-hidden" htmlFor={`${panelId}-message`}>Câu hỏi cho Men</label>
          <div className="assistant-widget__composer"><textarea ref={composer} id={`${panelId}-message`} rows="2" maxLength="2000" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Bạn muốn Men giúp điều gì?" required
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendMessage(draft); } }} />
            <button className="assistant-widget__send" type="submit" disabled={!draft.trim() || pending || (!usage && !usageError)} aria-label="Gửi câu hỏi"><Icon name="arrow" size={21} /></button></div>
          <div className="assistant-widget__compose-hint"><span>Enter để gửi · Shift + Enter để xuống dòng</span><span>{draft.length}/2000</span></div>
        </form>}
      {usageError && <p className="assistant-widget__usage-error">Chưa tải được số lượt. Hạn mức vẫn được kiểm tra khi gửi.</p>}
      <details className="assistant-widget__privacy"><summary>Thông tin riêng tư được bảo vệ thế nào?</summary><p>Câu hỏi được ẩn thông tin nhận dạng thường gặp trước khi gửi đến Gemini. Không gửi mật khẩu, OTP hoặc thông tin thanh toán. Lượt hỏi tính theo cookie trình duyệt, đặt lại lúc 00:00 giờ Việt Nam. Men có thể nhầm; giá, phí và tồn kho được kiểm tra lại khi đặt hàng.</p></details>
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
    </section>}
    {!open && <button ref={launcher} type="button" className="assistant-widget__launcher" aria-expanded="false" aria-controls={panelId} aria-label="Mở trợ lý tư vấn Men" onClick={() => setOpen(true)}>
      <img src={MASCOT} srcSet="/images/mascot/men-160.webp 1x, /images/mascot/men-320.webp 2x" alt="" width="80" height="80" /><span>Hỏi Men nè!</span>
    </button>}
  </div>;
}

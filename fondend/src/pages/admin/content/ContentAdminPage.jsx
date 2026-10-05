import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../services/httpClient.js';
import {
  archivePage,
  archiveStory,
  createPage,
  createStory,
  listAdminPages,
  listAdminStories,
  updatePage,
  updateStory,
} from '../../../services/content/content.service.js';
import '../../../components/story/story.css';

const emptyStory = () => ({
  slug: '', title: '', locale: 'vi', origin: '', artisan: '', motifs: [], sections: [], media: [], productIds: [], status: 'draft',
});
const emptyPage = () => ({ slug: '', title: '', locale: 'vi', blocks: [], status: 'draft' });
const pretty = (value) => JSON.stringify(value || [], null, 2);

function errorMessage(error) {
  if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') return 'Nội dung đã được cập nhật ở nơi khác. Tải lại danh sách trước khi sửa tiếp.';
  if (error instanceof ApiError && error.status === 403) return 'Tài khoản hiện tại không có quyền quản lý nội dung.';
  return error instanceof Error ? error.message : 'Không thể hoàn tất yêu cầu.';
}

export default function ContentAdminPage() {
  const [kind, setKind] = useState('stories');
  const [stories, setStories] = useState([]);
  const [pages, setPages] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(emptyStory());
  const [jsonFields, setJsonFields] = useState({ sections: '[]', media: '[]', blocks: '[]' });
  const [status, setStatus] = useState('loading');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const records = kind === 'stories' ? stories : pages;

  const load = useCallback(async () => {
    try {
      const [storyResponse, pageResponse] = await Promise.all([listAdminStories({ limit: 100 }), listAdminPages({ limit: 100 })]);
      setStories(storyResponse.data || []);
      setPages(pageResponse.data || []);
      setStatus('ready');
    } catch (loadError) {
      setError(errorMessage(loadError));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAdminStories({ limit: 100 }), listAdminPages({ limit: 100 })])
      .then(([storyResponse, pageResponse]) => {
        if (cancelled) return;
        setStories(storyResponse.data || []);
        setPages(pageResponse.data || []);
        setStatus('ready');
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(errorMessage(loadError));
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  function beginNew() {
    setSelectedId('');
    setDraft(kind === 'stories' ? emptyStory() : emptyPage());
    setJsonFields({ sections: '[]', media: '[]', blocks: '[]' });
    setMessage('Bản nháp mới. Thêm nguồn đã được xác minh trước khi xuất bản.');
    setError('');
  }

  function selectRecord(record) {
    setSelectedId(record.id);
    setDraft({ ...record, expectedVersion: record.version });
    setJsonFields({ sections: pretty(record.sections), media: pretty(record.media), blocks: pretty(record.blocks) });
    setMessage('');
    setError('');
  }

  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const base = {
        slug: draft.slug,
        title: draft.title,
        locale: draft.locale,
        status: draft.status,
      };
      let saved;
      if (kind === 'stories') {
        const payload = {
          ...base,
          origin: draft.origin,
          ...(draft.artisan ? { artisan: draft.artisan } : {}),
          motifs: String(draft.motifsText ?? draft.motifs?.join('\n') ?? '').split('\n').map((value) => value.trim()).filter(Boolean),
          sections: JSON.parse(jsonFields.sections),
          media: JSON.parse(jsonFields.media),
          productIds: String(draft.productIdsText ?? draft.productIds?.join('\n') ?? '').split('\n').map((value) => value.trim()).filter(Boolean),
          ...(selectedId ? { expectedVersion: draft.version } : {}),
        };
        saved = selectedId ? await updateStory(selectedId, payload) : await createStory(payload);
      } else {
        const payload = {
          ...base,
          blocks: JSON.parse(jsonFields.blocks),
          ...(selectedId ? { expectedVersion: draft.version } : {}),
        };
        saved = selectedId ? await updatePage(selectedId, payload) : await createPage(payload);
      }
      const record = saved.data;
      setMessage(`Đã lưu “${record.title}” ở trạng thái ${record.status}.`);
      await load();
      setSelectedId(record.id);
      setDraft({ ...record, expectedVersion: record.version });
      setJsonFields({ sections: pretty(record.sections), media: pretty(record.media), blocks: pretty(record.blocks) });
    } catch (saveError) {
      setError(saveError instanceof SyntaxError ? 'Nội dung JSON không hợp lệ.' : errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!selectedId || !window.confirm('Lưu trữ nội dung này? Nội dung đã lưu trữ sẽ không xuất hiện công khai.')) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (kind === 'stories') await archiveStory(selectedId, draft.version);
      else await archivePage(selectedId, draft.version);
      setMessage('Đã lưu trữ nội dung.');
      setSelectedId('');
      setDraft(kind === 'stories' ? emptyStory() : emptyPage());
      await load();
    } catch (archiveError) {
      setError(errorMessage(archiveError));
    } finally {
      setSaving(false);
    }
  }

  return <section className="content-admin" aria-labelledby="content-admin-title">
    <p className="story-eyebrow">Quản trị · P08</p>
    <h1 id="content-admin-title">Câu chuyện và trang nội dung</h1>
    <p className="content-warning">Chỉ xuất bản thông tin có nguồn đã kiểm tra và nội dung được duyệt. Bản EN phải do người dịch cung cấp; ứng dụng không tự dịch.</p>
    <nav className="content-admin-tabs" aria-label="Loại nội dung">
      <button type="button" aria-pressed={kind === 'stories'} onClick={() => { setKind('stories'); setSelectedId(''); setDraft(emptyStory()); }}>Câu chuyện</button>
      <button type="button" aria-pressed={kind === 'pages'} onClick={() => { setKind('pages'); setSelectedId(''); setDraft(emptyPage()); }}>Trang</button>
      <a href="/admin/nfc">Quản lý NFC</a>
    </nav>
    <div className="content-admin-toolbar">
      <button type="button" onClick={beginNew}>Tạo bản nháp</button>
      <button type="button" onClick={() => { setStatus('loading'); setError(''); load(); }} disabled={status === 'loading'}>Tải lại</button>
    </div>
    {status === 'loading' && <p role="status">Đang tải nội dung…</p>}
    {error && <p className="content-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <div className="content-admin-grid">
      <aside className="content-admin-list" aria-label={kind === 'stories' ? 'Danh sách câu chuyện' : 'Danh sách trang'}>
        {status === 'ready' && records.length === 0 && <p>Chưa có nội dung. Tạo bản nháp để bắt đầu.</p>}
        {records.map((record) => <button key={record.id} type="button" aria-current={selectedId === record.id ? 'true' : undefined} onClick={() => selectRecord(record)}>
          <strong>{record.title || '(Chưa có tiêu đề)'}</strong><br />
          <small>{record.locale} · {record.status} · v{record.version}</small>
        </button>)}
      </aside>
      <form className="content-editor" onSubmit={save}>
        <h2>{selectedId ? 'Chỉnh sửa nội dung' : 'Bản nháp mới'}</h2>
        <label>Slug<input required maxLength={180} value={draft.slug || ''} onChange={(event) => setField('slug', event.target.value)} /></label>
        <label>Tiêu đề<input required maxLength={300} value={draft.title || ''} onChange={(event) => setField('title', event.target.value)} /></label>
        <label>Ngôn ngữ<select value={draft.locale || 'vi'} onChange={(event) => setField('locale', event.target.value)}><option value="vi">Tiếng Việt</option><option value="en">English · bản dịch có người cung cấp</option></select></label>
        <label>Trạng thái<select value={draft.status || 'draft'} onChange={(event) => setField('status', event.target.value)}><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option><option value="archived">Đã lưu trữ</option></select></label>
        {kind === 'stories' ? <>
          <label>Nguồn / xuất xứ (để trống khi còn cần bổ sung)<input required={draft.status === 'published'} maxLength={2000} value={draft.origin || ''} onChange={(event) => setField('origin', event.target.value)} /></label>
          <label>Nghệ nhân (để trống khi chưa được xác minh)<input maxLength={300} value={draft.artisan || ''} onChange={(event) => setField('artisan', event.target.value)} /></label>
          <label>Motif, mỗi mục một dòng<textarea rows="4" value={draft.motifsText ?? draft.motifs?.join('\n') ?? ''} onChange={(event) => setField('motifsText', event.target.value)} /></label>
          <label>Sản phẩm liên kết, mỗi product ID một dòng<textarea rows="3" value={draft.productIdsText ?? draft.productIds?.join('\n') ?? ''} onChange={(event) => setField('productIdsText', event.target.value)} /></label>
          <label>Sections JSON<textarea required spellCheck="false" value={jsonFields.sections} onChange={(event) => setJsonFields((current) => ({ ...current, sections: event.target.value }))} aria-describedby="sections-help" /></label>
          <p id="sections-help" className="notice">Khối hỗ trợ: paragraph, heading, quote, list, image, link. Văn bản được lọc và render dưới dạng text an toàn.</p>
          <label>Media JSON<textarea spellCheck="false" value={jsonFields.media} onChange={(event) => setJsonFields((current) => ({ ...current, media: event.target.value }))} /></label>
        </> : <>
          <label>Blocks JSON<textarea required spellCheck="false" value={jsonFields.blocks} onChange={(event) => setJsonFields((current) => ({ ...current, blocks: event.target.value }))} /></label>
          <p className="notice">Blocks chỉ nhận các loại paragraph, heading, quote, list, image và link. Không chèn HTML.</p>
        </>}
        <div className="content-editor-actions">
          <button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu nội dung'}</button>
          {selectedId && draft.status !== 'archived' && <button type="button" disabled={saving} onClick={archive}>Lưu trữ</button>}
        </div>
      </form>
    </div>
  </section>;
}

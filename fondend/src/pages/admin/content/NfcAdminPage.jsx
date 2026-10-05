import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../services/httpClient.js';
import { createNfcTag, listAdminNfcTags, listAdminStories, revokeNfcTag } from '../../../services/content/content.service.js';
import '../../../components/story/story.css';

function messageFor(error) {
  if (error instanceof ApiError && error.status === 403) return 'Tài khoản hiện tại không có quyền quản lý NFC.';
  if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') return 'Thẻ đã được cập nhật ở nơi khác. Tải lại trước khi thử tiếp.';
  return error instanceof Error ? error.message : 'Không thể hoàn tất yêu cầu.';
}

export default function NfcAdminPage() {
  const [stories, setStories] = useState([]);
  const [tags, setTags] = useState([]);
  const [storyId, setStoryId] = useState('');
  const [productId, setProductId] = useState('');
  const [state, setState] = useState('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [storyResponse, tagResponse] = await Promise.all([
        listAdminStories({ status: 'published', limit: 100 }),
        listAdminNfcTags(),
      ]);
      setStories(storyResponse.data || []);
      setTags(tagResponse.data || []);
      setStoryId((current) => current || storyResponse.data?.[0]?.id || '');
      setState('ready');
    } catch (loadError) {
      setError(messageFor(loadError));
      setState('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAdminStories({ status: 'published', limit: 100 }), listAdminNfcTags()])
      .then(([storyResponse, tagResponse]) => {
        if (cancelled) return;
        setStories(storyResponse.data || []);
        setTags(tagResponse.data || []);
        setStoryId((current) => current || storyResponse.data?.[0]?.id || '');
        setState('ready');
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(messageFor(loadError));
        setState('error');
      });
    return () => { cancelled = true; };
  }, []);

  async function create(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await createNfcTag({ storyId, ...(productId.trim() ? { productId: productId.trim() } : {}) });
      setNotice(`Đã tạo thẻ. URL công khai: ${window.location.origin}${result.data.publicUrl}`);
      setProductId('');
      await load();
    } catch (createError) {
      setError(messageFor(createError));
    } finally {
      setSaving(false);
    }
  }

  async function revoke(tag) {
    const reason = window.prompt('Lý do thu hồi thẻ NFC');
    if (reason === null) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await revokeNfcTag(tag.id, { reason, expectedVersion: tag.version });
      setNotice(`Đã thu hồi thẻ ${tag.publicId}. Public URL trả trạng thái 410.`);
      await load();
    } catch (revokeError) {
      setError(messageFor(revokeError));
    } finally {
      setSaving(false);
    }
  }

  return <section className="nfc-admin" aria-labelledby="nfc-admin-title">
    <p className="story-eyebrow">Quản trị · P08</p>
    <h1 id="nfc-admin-title">Quản lý thẻ NFC</h1>
    <p>Thẻ chỉ trỏ tới câu chuyện đã xuất bản. URL NFC là đường dẫn nội dung, không phải chứng nhận nguồn gốc hay quyền truy cập đơn hàng.</p>
    <div className="content-admin-toolbar"><a href="/admin/content">Quay lại nội dung</a><button type="button" onClick={() => { setState('loading'); setError(''); load(); }} disabled={state === 'loading'}>Tải lại</button></div>
    {state === 'loading' && <p role="status">Đang tải thẻ NFC…</p>}
    {error && <p className="content-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <form className="content-editor" onSubmit={create}>
      <h2>Tạo thẻ</h2>
      {stories.length === 0 ? <p>Chưa có câu chuyện được xuất bản. Xuất bản câu chuyện đã được duyệt trước.</p> : <>
        <label>Câu chuyện<select required value={storyId} onChange={(event) => setStoryId(event.target.value)}>
          {stories.map((story) => <option key={story.id} value={story.id}>{story.title} · {story.locale}</option>)}
        </select></label>
        <label>Product ID tùy chọn<input value={productId} onChange={(event) => setProductId(event.target.value)} placeholder="ObjectId từ catalog quản trị" /></label>
        <button type="submit" disabled={saving || !storyId}>{saving ? 'Đang tạo…' : 'Tạo URL NFC'}</button>
      </>}
    </form>
    <h2>Thẻ hiện có</h2>
    {state === 'ready' && tags.length === 0 && <p>Chưa có thẻ NFC.</p>}
    <ul className="nfc-tag-list">
      {tags.map((tag) => <li key={tag.id}>
        <p><strong>{tag.status === 'active' ? 'Đang hoạt động' : 'Đã thu hồi'}</strong> · phiên bản {tag.version}</p>
        <p>Mã công khai: <code>{tag.publicId}</code></p>
        <p>Câu chuyện ID: <code>{tag.storyId}</code></p>
        {tag.productId && <p>Sản phẩm ID: <code>{tag.productId}</code></p>}
        <p><a href={`/nfc/${encodeURIComponent(tag.publicId)}`}>Mở trang NFC</a></p>
        {tag.status === 'active' && <button type="button" disabled={saving} onClick={() => revoke(tag)}>Thu hồi</button>}
      </li>)}
    </ul>
  </section>;
}

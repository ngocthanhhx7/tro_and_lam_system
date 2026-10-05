import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { identityApi } from '../../../services/identity/identity.api.js';
import '../users/identity-admin.css';

export default function AdminAppealDetailPage() {
  const { id } = useParams();
  const [appeal, setAppeal] = useState(null);
  const [loadedId, setLoadedId] = useState(null);
  const [decision, setDecision] = useState('approved');
  const [reviewNote, setReviewNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const isLoading = loading || loadedId !== id;

  const load = useCallback(async () => {
    try {
      let page = 1;
      let found = null;
      let pageCount = 1;
      do {
        const response = await identityApi.listAppeals(`?page=${page}&limit=100`);
        found = response.data.find((record) => record.id === id) || null;
        pageCount = response.meta.pagination.totalPages;
        page += 1;
      } while (!found && page <= pageCount);
      if (!found) throw new Error('Không tìm thấy kháng nghị. Tải lại danh sách để kiểm tra trạng thái mới.');
      setAppeal(found);
      setError(null);
    } catch (requestError) { setError(requestError); }
    finally { setLoading(false); setLoadedId(id); }
  }, [id]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(null); setSuccess('');
    try {
      const response = await identityApi.decideAppeal(id, { decision, reviewNote, expectedVersion: appeal.version });
      setAppeal((current) => ({ ...current, ...response.data }));
      setSuccess(decision === 'approved' ? 'Kháng nghị được chấp thuận và tài khoản đã mở. Người dùng cần đăng nhập lại.' : 'Kháng nghị được từ chối; lý do đã được lưu để gửi thông báo.');
      setConfirmed(false);
    } catch (requestError) { setError(requestError); }
    finally { setBusy(false); }
  }

  const currentAppeal = appeal?.id === id ? appeal : null;
  if (isLoading) return <main className="identity-admin__state" role="status">Đang tải kháng nghị…</main>;
  if (error && !currentAppeal) return <main className="identity-admin__state"><p role="alert" className="identity-admin__error">{error.message}</p><button className="identity-admin__secondary" onClick={() => { setLoading(true); setError(null); void load(); }} type="button">Thử lại</button><p><Link to="/admin/appeals">Quay lại hàng đợi</Link></p></main>;
  if (!currentAppeal) return null;

  return <section className="identity-admin"><header className="identity-admin__header"><div><p className="identity-eyebrow">XEM XÉT KHÁNG NGHỊ</p><h1>{appeal.user?.name || 'Tài khoản'}</h1><p>{appeal.user?.email} · {appeal.user?.role} · {appeal.user?.status}</p></div><Link to="/admin/appeals">Quay lại hàng đợi</Link></header>
    {error && <p role="alert" className="identity-admin__error">{error.message}</p>}{success && <p role="status" className="identity-admin__success">{success}</p>}
    <section className="identity-admin__panel"><h2>Hồ sơ kháng nghị</h2><dl className="identity-admin__facts"><div><dt>Lý do khóa</dt><dd>{appeal.user?.blockedReason || 'Không có ghi chú'}</dd></div><div><dt>Nội dung người dùng</dt><dd>{appeal.message}</dd></div><div><dt>Đã gửi</dt><dd>{appeal.submittedAt ? new Date(appeal.submittedAt).toLocaleString('vi-VN') : '—'}</dd></div><div><dt>Trạng thái</dt><dd>{appeal.status}</dd></div>{appeal.reviewNote && <div><dt>Ghi chú quyết định</dt><dd>{appeal.reviewNote}</dd></div>}</dl></section>
    {appeal.status === 'pending' && <form className="identity-admin__panel identity-admin__form" onSubmit={submit}><h2>Quyết định quản trị viên</h2>
      <label>Quyết định<select value={decision} onChange={(event) => setDecision(event.target.value)}><option value="approved">Chấp thuận và mở khóa</option><option value="rejected">Từ chối</option></select></label>
      <label>Lý do gửi tới người dùng<textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} required minLength={1} maxLength={1000} /></label>
      <label className="identity-admin__check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Tôi xác nhận đây là quyết định thủ công và cần được ghi vào lịch sử.</label>
      <button className="identity-admin__primary" type="submit" disabled={busy || !confirmed}>{busy ? 'Đang lưu quyết định…' : decision === 'approved' ? 'Chấp thuận kháng nghị' : 'Từ chối kháng nghị'}</button>
    </form>}
  </section>;
}

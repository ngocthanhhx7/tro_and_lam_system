import { Link, Outlet } from 'react-router-dom';

export default function MainLayout() {
  return <><header><Link className="brand" to="/">TRO & LAM</Link><span>Gốm Chu Đậu · Văn hóa Việt</span></header><main><Outlet /></main><footer>TRO & LAM · Nghề truyền thống, thiết kế đương đại.</footer></>;
}

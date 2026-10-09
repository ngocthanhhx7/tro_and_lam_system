import { Link } from 'react-router-dom';
import Icon from '../catalog/Icon.jsx';
import { formatDate, formatMoney, orderStatusLabel, paymentStatusLabel } from '../../pages/commerce/commerce.format.js';
import { count } from './workspaceUtils.js';

export function WorkspaceMetric({ label, value, detail, icon = 'receipt', to }) {
  return <article className="operations-metric"><Icon className="workspace-metric-icon" name={icon} size={30} /><span>{label}</span><strong>{value}</strong><small>{detail || 'Trong khoảng thời gian đã chọn'}{to && <Link to={to} aria-label={`Mở ${label}`} style={{ float: 'right' }}><Icon name="arrow" size={15} /></Link>}</small></article>;
}

export function WorkspacePanel({ title, description, to, children, action }) {
  return <section className="workspace-panel"><header className="workspace-panel__heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{to && <Link to={to}>Xem tất cả <Icon name="arrow" size={16} /></Link>}{action}</header>{children}</section>;
}

export function RecentOrders({ orders = [], home = '/admin', error = '', title = 'Đơn hàng gần đây' }) {
  return <WorkspacePanel title={title} description="Theo dõi tình trạng đơn và thanh toán." to={`${home}/orders`}>
    {error ? <p className="operations-error" role="alert">{error}</p> : !orders.length ? <p className="workspace-empty">Chưa có đơn hàng trong khoảng thời gian này.</p> : <div className="workspace-table-wrap"><table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày đặt</th><th>Tổng tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><Link to={`${home}/orders/${order.id}`}>{order.code}</Link></td><td>{order.recipient?.recipientName || '—'}<small>{order.recipient?.phone}</small></td><td>{formatDate(order.createdAt)}</td><td>{formatMoney(order.totalVnd)}<small>{paymentStatusLabel[order.paymentStatus]}</small></td><td><span className={`workspace-badge workspace-badge--${order.status}`}>{orderStatusLabel[order.status]}</span></td><td><Link to={`${home}/orders/${order.id}`}>Chi tiết</Link></td></tr>)}</tbody></table></div>}
  </WorkspacePanel>;
}

const statusColors = ['#2f6c55', '#00293b', '#cfb463', '#a9965b', '#923b3b', '#889994', '#677980', '#b8beb7'];
export function OrderBreakdown({ counts = {} }) {
  const entries = Object.entries(counts);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const delivered = counts.delivered || 0;
  let offset = 0;
  const slices = entries.filter(([, value]) => value).map(([status, value]) => {
    const start = offset; offset += value / total * 100;
    return `${statusColors[entries.findIndex(([key]) => key === status)]} ${start}% ${offset}%`;
  });
  return <WorkspacePanel title="Cơ cấu đơn hàng" description={`${count(total)} đơn được tạo trong kỳ`}>
    <div className="workspace-donut" style={{ background: slices.length ? `conic-gradient(${slices.join(',')})` : '#eee9dc' }} aria-label={`${count(delivered)} trên ${count(total)} đơn đã giao`}><div><strong>{total ? Math.round(delivered / total * 100) : 0}%</strong><small>Đã bàn giao</small></div></div>
    <div className="workspace-breakdown">{entries.map(([status, value], index) => <div key={status}><span><i style={{ background: statusColors[index] }} />{orderStatusLabel[status] || status}</span><strong>{count(value)} đơn</strong><small>{total ? Math.round(value / total * 100) : 0}%</small></div>)}</div>
  </WorkspacePanel>;
}

import { useId, useMemo, useState } from 'react';

const CHART_WIDTH = 840;
const CHART_HEIGHT = 330;
const PLOT = { top: 18, right: 18, bottom: 48, left: 76 };
const numberFormat = new Intl.NumberFormat('vi-VN');
const dateFormat = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', day: '2-digit', month: 'short' });
const fullDateFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
});

function formatVnd(value) {
  return `${numberFormat.format(value)} ₫`;
}

function compactVnd(value) {
  if (value >= 1_000_000_000) return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value / 1_000_000_000)} tỷ`;
  if (value >= 1_000_000) return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value / 1_000_000)} tr`;
  if (value >= 1_000) return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value / 1_000)} nghìn`;
  return numberFormat.format(value);
}

function niceMaximum(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatDate(value) {
  return fullDateFormat.format(new Date(`${value}T12:00:00Z`));
}

function pointLabel(point, previous) {
  const compare = previous ? `; kỳ trước ${formatDate(previous.comparisonDate)}: ${formatVnd(previous.grossCollectedVnd)}` : '';
  return `${formatDate(point.date)}; đã thu ${formatVnd(point.grossCollectedVnd)}${compare}`;
}

export default function RevenueTrendChart({ trend, loading = false }) {
  const titleId = useId();
  const descriptionId = useId();
  const [activeIndex, setActiveIndex] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const chart = useMemo(() => {
    const points = Array.isArray(trend?.daily) ? trend.daily : [];
    const comparison = Array.isArray(trend?.comparisonDaily) ? trend.comparisonDaily : [];
    if (points.length > 367 || comparison.length !== points.length
      || points.some((point) => !/^\d{4}-\d{2}-\d{2}$/u.test(point.date)
        || !Number.isSafeInteger(point.grossCollectedVnd) || point.grossCollectedVnd < 0)
      || comparison.some((point, index) => point.date !== points[index]?.date
        || !/^\d{4}-\d{2}-\d{2}$/u.test(point.comparisonDate)
        || !Number.isSafeInteger(point.grossCollectedVnd) || point.grossCollectedVnd < 0)) {
      return { points: [], comparison: [], current: [], prior: [], currentLine: '', previousLine: '', area: '', ticks: [], labelIndexes: [], baseline: 0, x: () => 0 };
    }
    const maxValue = niceMaximum(Math.max(0, ...points.map((point) => point.grossCollectedVnd), ...comparison.map((point) => point.grossCollectedVnd)));
    const plotWidth = CHART_WIDTH - PLOT.left - PLOT.right;
    const plotHeight = CHART_HEIGHT - PLOT.top - PLOT.bottom;
    const x = (index) => points.length <= 1 ? PLOT.left + plotWidth / 2 : PLOT.left + (index / (points.length - 1)) * plotWidth;
    const y = (value) => PLOT.top + plotHeight - (value / maxValue) * plotHeight;
    const current = points.map((point, index) => ({ ...point, x: x(index), y: y(point.grossCollectedVnd || 0) }));
    const prior = comparison.map((point, index) => ({ ...point, x: x(index), y: y(point.grossCollectedVnd || 0) }));
    const currentLine = current.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
    const previousLine = prior.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
    const baseline = PLOT.top + plotHeight;
    const area = current.length
      ? `${currentLine} L${current.at(-1).x},${baseline} L${current[0].x},${baseline} Z`
      : '';
    const ticks = Array.from({ length: 5 }, (_, index) => {
      const value = maxValue * (index / 4);
      return { value, y: y(value) };
    });
    const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 3), Math.floor(((points.length - 1) * 2) / 3), points.length - 1])];
    return { points, comparison, current, prior, currentLine, previousLine, area, maxValue, baseline, ticks, labelIndexes, x };
  }, [trend]);

  if (!chart.points.length) {
    return <div className="admin-chart-empty" role="status">
      {Array.isArray(trend?.daily) && trend.daily.length
        ? 'Dữ liệu biểu đồ không hợp lệ hoặc chưa sẵn sàng.'
        : 'Không có ngày dữ liệu trong phản hồi thống kê.'}
    </div>;
  }

  const selectedIndex = activeIndex === null
    ? chart.points.length - 1
    : Math.max(0, Math.min(activeIndex, chart.points.length - 1));
  const selected = chart.points[selectedIndex];
  const selectedComparison = chart.comparison[selectedIndex];
  const label = pointLabel(selected, selectedComparison);

  function handlePointerMove(event) {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    const chartX = ((event.clientX - bounds.left) / bounds.width) * CHART_WIDTH;
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    chart.current.forEach((point, index) => {
      const currentDistance = Math.abs(point.x - chartX);
      if (currentDistance < distance) {
        nearest = index;
        distance = currentDistance;
      }
    });
    setActiveIndex(nearest);
  }

  return (
    <section className={`admin-chart${loading ? ' is-refreshing' : ''}`} aria-labelledby={titleId} aria-busy={loading}>
      <div className="admin-chart__heading">
        <div>
          <h2 id={titleId}>Tiền đã thu theo ngày</h2>
          <p id={descriptionId}>Tiền PayOS đã xác nhận và COD đã ghi nhận, theo ngày Việt Nam. Đối chiếu cùng số ngày liền trước.</p>
        </div>
        <div className="admin-chart__legend" aria-label="Chú giải">
          <span><i className="admin-chart__legend-mark" aria-hidden="true" />Kỳ đang xem</span>
          <span><i className="admin-chart__legend-mark admin-chart__legend-mark--previous" aria-hidden="true" />Kỳ liền trước</span>
        </div>
      </div>

      <div className="admin-chart__plot-wrap">
        <svg
          className="admin-chart__plot"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-labelledby={`${titleId} ${descriptionId}`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setActiveIndex(null)}
          onPointerCancel={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id={`${titleId}-area`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" className="admin-chart__area-stop--top" />
              <stop offset="100%" className="admin-chart__area-stop--bottom" />
            </linearGradient>
          </defs>
          {chart.ticks.map(({ value, y }) => (
            <g key={value}>
              <line x1={PLOT.left} x2={CHART_WIDTH - PLOT.right} y1={y} y2={y} className="admin-chart__gridline" />
              <text x={PLOT.left - 10} y={y + 4} textAnchor="end" className="admin-chart__axis-label">{compactVnd(value)}</text>
            </g>
          ))}
          {chart.area && <path d={chart.area} fill={`url(#${titleId}-area)`} className="admin-chart__area" />}
          {chart.previousLine && <path d={chart.previousLine} className="admin-chart__line admin-chart__line--previous" />}
          {chart.currentLine && <path d={chart.currentLine} className="admin-chart__line admin-chart__line--current" />}
          {chart.labelIndexes.map((index) => {
            const point = chart.current[index];
            return <text key={point.date} x={point.x} y={CHART_HEIGHT - 14} textAnchor="middle" className="admin-chart__axis-label">{dateFormat.format(new Date(`${point.date}T12:00:00Z`))}</text>;
          })}
          {activeIndex >= 0 && chart.current[activeIndex] && <>
            <line x1={chart.current[activeIndex].x} x2={chart.current[activeIndex].x} y1={PLOT.top} y2={chart.baseline} className="admin-chart__crosshair" />
            <circle cx={chart.current[activeIndex].x} cy={chart.current[activeIndex].y} r="6" className="admin-chart__marker" />
            {chart.prior[activeIndex] && <circle cx={chart.prior[activeIndex].x} cy={chart.prior[activeIndex].y} r="5" className="admin-chart__marker admin-chart__marker--previous" />}
          </>}
        </svg>
      </div>

      <div className="admin-chart__readout" aria-live="polite" aria-atomic="true">
        <span className="admin-chart__readout-date">{formatDate(selected.date)}</span>
        <strong>{formatVnd(selected.grossCollectedVnd)}</strong>
        {selectedComparison && <span className="admin-chart__readout-previous">Kỳ trước · {formatDate(selectedComparison.comparisonDate)} · {formatVnd(selectedComparison.grossCollectedVnd)}</span>}
      </div>

      <label className="admin-chart__scrubber">
        <span>Chọn ngày trên biểu đồ</span>
        <input
          type="range"
          min="0"
          max={chart.points.length - 1}
          value={Math.max(0, activeIndex ?? selectedIndex)}
          aria-label="Chọn ngày để xem số tiền đã thu và kỳ đối chiếu"
          aria-valuetext={label}
          onChange={(event) => setActiveIndex(Number(event.target.value))}
          onFocus={() => setActiveIndex(Math.max(0, activeIndex ?? selectedIndex))}
        />
      </label>

      <button type="button" className="admin-chart__table-toggle" aria-expanded={showTable} onClick={() => setShowTable((value) => !value)}>
        {showTable ? 'Ẩn bảng dữ liệu' : 'Xem bảng dữ liệu'}
      </button>
      {showTable && <div className="admin-chart__table-wrap">
        <table className="admin-chart__table">
          <caption>Dữ liệu tiền đã thu theo ngày và kỳ đối chiếu</caption>
          <thead><tr><th scope="col">Ngày</th><th scope="col">Tiền đã thu</th><th scope="col">Ngày kỳ trước</th><th scope="col">Tiền kỳ trước</th></tr></thead>
          <tbody>{chart.points.map((point, index) => {
            const previous = chart.comparison[index];
            return <tr key={point.date}>
              <th scope="row">{formatDate(point.date)}</th>
              <td>{formatVnd(point.grossCollectedVnd)}</td>
              <td>{previous ? formatDate(previous.comparisonDate) : '—'}</td>
              <td>{previous ? formatVnd(previous.grossCollectedVnd) : '—'}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    </section>
  );
}

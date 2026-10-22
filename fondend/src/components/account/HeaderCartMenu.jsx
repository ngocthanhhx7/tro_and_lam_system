import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { accountApi } from '../../services/account/account.api.js';
import { CART_UPDATED_EVENT, getCartItemCount } from '../../services/account/cartEvents.js';
import { productImageProps } from '../../services/catalog/productImage.js';
import Icon from '../catalog/Icon.jsx';
import './header-cart-menu.css';

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);

export default function HeaderCartMenu() {
  const [state, setState] = useState({ cart: null, loading: true, error: false });
  const menu = useRef(null);
  const active = useRef(false);
  const revision = useRef(0);
  const { pathname } = useLocation();
  const refresh = useCallback(async () => {
    const requestRevision = ++revision.current;
    try {
      const response = await accountApi.getCart();
      if (active.current && requestRevision === revision.current) setState({ cart: response.data, loading: false, error: false });
    } catch {
      if (active.current && requestRevision === revision.current) setState({ cart: null, loading: false, error: true });
    }
  }, []);

  useEffect(() => {
    active.current = true;
    const update = event => {
      revision.current += 1;
      setState({ cart: event.detail?.cart || null, loading: false, error: false });
    };
    window.addEventListener(CART_UPDATED_EVENT, update);
    const requestRevision = ++revision.current;
    accountApi.getCart().then(response => {
      if (active.current && requestRevision === revision.current) setState({ cart: response.data, loading: false, error: false });
    }).catch(() => {
      if (active.current && requestRevision === revision.current) setState({ cart: null, loading: false, error: true });
    });
    return () => { active.current = false; window.removeEventListener(CART_UPDATED_EVENT, update); };
  }, []);
  useEffect(() => { if (menu.current) menu.current.open = false; }, [pathname]);

  const items = state.cart?.items || [];
  const count = getCartItemCount(state.cart);
  const subtotal = items.filter(item => item.checkoutEligible && Number.isSafeInteger(item.lineTotalVnd))
    .reduce((total, item) => total + item.lineTotalVnd, 0);
  const close = () => { menu.current.open = false; };
  return <details className="header-cart-menu" ref={menu}
    onPointerEnter={event => { if (event.pointerType === 'mouse') event.currentTarget.open = true; }}
    onPointerLeave={event => { if (event.pointerType === 'mouse') event.currentTarget.open = false; }}
    onToggle={event => {
      if (event.currentTarget.open) {
        setState(current => ({ ...current, loading: true, error: false }));
        void refresh();
      }
    }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
    onKeyDown={event => { if (event.key === 'Escape') { close(); menu.current.querySelector('summary').focus(); } }}>
    <summary className="catalog-header__icon-link catalog-header__cart-link" aria-label={count > 0 ? `Giỏ hàng, ${count} sản phẩm` : 'Giỏ hàng'}>
      <Icon name="bag" />{count > 0 && <span className="catalog-header__cart-count" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
    </summary>
    <section className="header-cart-menu__dropdown" aria-label="Xem trước giỏ hàng" aria-busy={state.loading}>
      <h2>Giỏ hàng của bạn</h2>
      {state.loading ? <p role="status">Đang tải giỏ hàng…</p>
        : state.error ? <p role="alert">Chưa thể tải giỏ hàng. Bạn hãy mở giỏ hàng để thử lại.</p>
          : !items.length ? <p>Giỏ hàng đang trống.</p>
            : <>
              <ul className="header-cart-menu__items">{items.slice(0, 4).map(item => <li key={item.productId}>
                {item.product?.imageUrl ? <img {...productImageProps(item.product.imageUrl, { width: 160, sizes: '56px' })} alt="" width="56" height="64" loading="lazy" /> : <span className="header-cart-menu__placeholder" aria-hidden="true"><Icon name="bag" /></span>}
                <div>{item.product?.slug ? <Link to={`/san-pham/${encodeURIComponent(item.product.slug)}`} onClick={close}>{item.product.name}</Link> : <strong>{item.product?.name || 'Sản phẩm không còn mở bán'}</strong>}
                  <span>Số lượng: {item.quantity}</span>
                  <span>{item.checkoutEligible && Number.isSafeInteger(item.lineTotalVnd) ? money(item.lineTotalVnd) : 'Cần kiểm tra lại'}</span>
                </div>
              </li>)}</ul>
              {items.length > 4 && <p>Còn {items.length - 4} mặt hàng trong giỏ.</p>}
              <div className="header-cart-menu__subtotal"><span>Tạm tính</span><strong>{money(subtotal)}</strong></div>
              <p className="header-cart-menu__note">Tạm tính các sản phẩm có thể mua, chưa gồm phí giao hàng và ưu đãi.</p>
            </>}
      <Link className="header-cart-menu__view" to="/gio-hang" onClick={close}>Xem giỏ hàng<Icon name="arrow" size={16} /></Link>
    </section>
  </details>;
}

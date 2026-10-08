export const CART_UPDATED_EVENT = 'tro-lam:cart-updated';

export function getCartItemCount(cart) {
  if (!Array.isArray(cart?.items)) return 0;
  return cart.items.reduce((total, item) => total + (
    Number.isSafeInteger(item?.quantity) && item.quantity > 0 ? item.quantity : 0
  ), 0);
}

export function publishCartUpdate(cart) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, {
    detail: { count: getCartItemCount(cart) },
  }));
}

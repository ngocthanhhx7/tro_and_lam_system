export function payosCheckoutUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('PayOS chưa trả về đường dẫn thanh toán hợp lệ.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'pay.payos.vn' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('Đường dẫn thanh toán không thuộc trang PayOS hợp lệ nên đã bị chặn.');
  }
  return url.href;
}

export async function startHostedCheckout({ orderId, requestKey, createAttempt, redirect }) {
  const response = await createAttempt(orderId, requestKey);
  const url = payosCheckoutUrl(response?.data?.checkoutUrl);
  redirect(url);
  return response.data;
}

export function getProductImageSource(image) {
  const url = typeof image?.url === 'string' ? image.url : '';
  if (url.startsWith('/assets/products/concepts/') || url.startsWith('/assets/products/generated/')) {
    return {
      kind: 'concept',
      badge: 'Ảnh AI minh họa',
      disclosure: 'Ảnh concept AI · Minh họa ý tưởng, chưa xác nhận là ảnh chụp sản phẩm thực tế.',
    };
  }
  if (url.startsWith('/assets/products/owner-provided/') || url.startsWith('/images/products/')) {
    const isSharedPairPhoto = url.endsWith('/hoa-lam-ty-ba-pair.webp');
    return {
      kind: 'provided',
      badge: 'Ảnh do chủ dự án cung cấp',
      disclosure: isSharedPairPhoto
        ? 'Ảnh do chủ dự án cung cấp: ảnh chung có cả bình Hoa Lam và Tỳ Bà, không phải góc chụp riêng của sản phẩm này.'
        : 'Ảnh sản phẩm do chủ dự án cung cấp.',
    };
  }
  if (url.startsWith('/assets/products/derived/')) {
    return {
      kind: 'derived',
      badge: 'Chi tiết từ ảnh gốc',
      disclosure: 'Chi tiết được cắt từ ảnh do chủ dự án cung cấp; đây không phải góc chụp mới.',
    };
  }
  return null;
}

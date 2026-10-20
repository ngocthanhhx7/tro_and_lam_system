import { useSyncExternalStore } from 'react';
import Icon from './Icon.jsx';
import './quick-contact.css';

// Public contact details transcribed from the project brief supplied by the owner.
const quickContacts = [
  {
    label: 'Hotline · 0966 051 231',
    href: 'tel:0966051231',
    ariaLabel: 'Gọi hotline 0966 051 231',
    icon: 'phone',
    external: false,
  },
  {
    label: 'Zalo',
    href: 'https://zalo.me/0966051231',
    ariaLabel: 'Nhắn tin qua Zalo (mở tab mới)',
    icon: 'zalo',
    external: true,
  },
  {
    label: 'Messenger',
    href: 'https://m.me/gomchudautrovalam',
    ariaLabel: 'Nhắn tin qua Messenger (mở tab mới)',
    icon: 'message',
    external: true,
  },
];

function ContactIcon({ name }) {
  if (name === 'zalo') return <img src="/assets/contact/zalo.svg" alt="" width="28" height="28" />;
  if (name === 'message') return <svg viewBox="0 0 22 22" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M11 0C4.925 0 0 4.943 0 11.04c0 5.178 3.552 9.523 8.343 10.716v-7.342H6.075V11.04h2.268V9.587c0-3.758 1.694-5.5 5.37-5.5.697 0 1.9.138 2.391.274V7.42c-.26-.028-.71-.041-1.27-.041-1.804 0-2.501.685-2.501 2.468v1.193h3.593l-.617 3.374h-2.976V22C17.78 21.34 22 16.685 22 11.04 22 4.943 17.075 0 11 0" /></svg>;
  return <Icon name={name} size={22} />;
}

function subscribeToScroll(onChange) {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
}

export function QuickContactLinks() {
  const hasScrolled = useSyncExternalStore(subscribeToScroll, () => window.scrollY > 0, () => false);
  return (
    <nav className="quick-contact" aria-label="Liên hệ nhanh">
      {quickContacts.map((contact) => (
        <a
          className={`quick-contact__link quick-contact__link--${contact.icon}`}
          href={contact.href}
          key={contact.label}
          aria-label={contact.ariaLabel}
          target={contact.external ? '_blank' : undefined}
          rel={contact.external ? 'noopener noreferrer' : undefined}
        >
          <span className="quick-contact__icon"><ContactIcon name={contact.icon} /></span>
          <span className="quick-contact__label" aria-hidden="true">{contact.label}</span>
        </a>
      ))}
      {hasScrolled && <button className="quick-contact__link quick-contact__link--top" type="button" aria-label="Lên đầu trang"
        onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>
        <span className="quick-contact__icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 14 6-6 6 6M12 8v12" /></svg></span>
        <span className="quick-contact__label" aria-hidden="true">Lên đầu trang</span>
      </button>}
    </nav>
  );
}

import Icon from './Icon.jsx';

// Public contact details transcribed from the project brief supplied by the owner.
const quickContacts = [
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
  {
    label: 'Hotline',
    href: 'tel:0966051231',
    ariaLabel: 'Gọi hotline 0966 051 231',
    icon: 'phone',
    external: false,
  },
];

function ContactIcon({ name }) {
  if (name === 'zalo') return <span className="quick-contact__zalo-mark" aria-hidden="true">Z</span>;
  return <Icon name={name} size={17} />;
}

export function QuickContactLinks() {
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
          <span className="quick-contact__label">{contact.label}</span>
        </a>
      ))}
    </nav>
  );
}

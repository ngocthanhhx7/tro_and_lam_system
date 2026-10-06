const paths = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2" /></>,
  bag: <><path d="M5 7h14l1 14H4L5 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  play: <path d="m9 5 11 7-11 7V5Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  message: <path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.4-4.7A9 9 0 1 1 21 11.5ZM8 11h8m-8 4h5" />,
  leaf: <><path d="M20 4C9 2 2 9 6 16s16 2 14-12Z" /><path d="m4 21 11-11" /></>,
  gift: <><path d="M3 9h18v4H3zm2 4v8h14v-8M12 9v12" /><path d="M12 9C3 9 6 1 10 5l2 4Zm0 0c9 0 6-8 2-4l-2 4Z" /></>,
};
export default function Icon({ name, size = 22, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.arrow}</svg>;
}

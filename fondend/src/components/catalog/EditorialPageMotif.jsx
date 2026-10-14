import DecorativeMotif from './DecorativeMotif.jsx';
import './editorial-page-motifs.css';

// Fit the complete artwork inside its existing content pane, without changing layout.
export default function EditorialPageMotif({ motif, opacity = .16, align = 'center' }) {
  return <div className={`editorial-page-motif editorial-page-motif--${align}`} aria-hidden="true" data-editorial-motif={motif}>
    <DecorativeMotif motif={motif} placement="canvas" size="100%" opacity={opacity} breakpoint="mobile" />
  </div>;
}

import { useState } from 'react';
import Icon from './Icon.jsx';
import { media } from '../../constants/editorialMedia.js';

export function HeritageFilm() {
  const [playing, setPlaying] = useState(false);
  return <section className="heritage-film" id="phim-gom" aria-labelledby="film-title">
    <div className="heritage-film__visual">
      {playing ? <iframe src="https://www.youtube-nocookie.com/embed/AVtL9Y3ndTY?autoplay=1" title="Sức sống gốm Chu Đậu — VTV4" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        : <><img src={media.hands} alt="Đôi bàn tay tạo hình đất trên bàn xoay" loading="lazy" /><button className="film-play" onClick={() => setPlaying(true)} aria-label="Xem phim Sức sống gốm Chu Đậu"><Icon name="play" size={30} /></button></>}
    </div>
    <div className="heritage-film__copy"><p className="eyebrow">GÓC NHÌN VỀ GỐM</p><h2 id="film-title">Một thước phim.<br />Một miền cảm hứng.</h2><p>Dừng lại đôi chút, cùng tìm hiểu gốm Chu Đậu qua những thước phim của VTV4.</p><a className="text-link" href="https://www.youtube.com/watch?v=AVtL9Y3ndTY" target="_blank" rel="noreferrer">Xem trên YouTube · VTV4 <Icon name="arrow" size={18} /></a></div>
  </section>;
}

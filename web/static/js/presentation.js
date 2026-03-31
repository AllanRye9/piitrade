/**
 * presentation.js – slide rendering & viewer logic
 *
 * Handles:
 *  - Rendering text / image / table slides into #slide-canvas
 *  - Slide navigation (next, prev, jump, first, last)
 *  - Fullscreen mode
 *  - Blackout toggle
 *  - Zoom (in / out / reset)
 *  - Thumbnail strip
 *  - Pen-tool / eraser / pointer (canvas annotation layer)
 */

export class PresentationViewer {
  /**
   * @param {Object} opts
   * @param {function(number, number): void} [opts.onSlideChange]
   */
  constructor({ onSlideChange } = {}) {
    this.slides       = [];
    this.currentIndex = 0;
    this.zoom         = 1;
    this.onSlideChange = onSlideChange || (() => {});

    // DOM refs
    this.$canvas    = document.getElementById('slide-canvas');
    this.$panel     = document.getElementById('slide-panel');
    this.$stage     = document.getElementById('slide-stage');
    this.$blackout  = document.getElementById('blackout-overlay');
    this.$navPrev   = document.getElementById('nav-prev');
    this.$navNext   = document.getElementById('nav-next');
    this.$counter   = document.getElementById('slide-counter');
    this.$notes     = document.getElementById('notes-panel');

    // annotation canvas
    this._annotCanvas  = null;
    this._annotCtx     = null;
    this._drawMode     = 'pointer'; // 'pointer' | 'pen' | 'eraser'
    this._drawing      = false;
    this._lastX        = 0;
    this._lastY        = 0;
    this._annotations  = {}; // slideIndex → ImageData
    this._penColor     = '#ff4444';
    this._penWidth     = 4;

    // blackout click closes it
    this.$blackout.addEventListener('click', () => this.toggleBlackout(false));

    // keyboard navigation
    document.addEventListener('keydown', (e) => this._onKey(e));
  }

  // ── public API ──────────────────────────────────────────────────────────

  load(slides) {
    this.slides       = slides;
    this.currentIndex = 0;
    this.zoom         = 1;
    this._annotations = {};
    this._buildThumbs();
    this._render();
  }

  get totalSlides() { return this.slides.length; }
  get current()     { return this.currentIndex + 1; }

  next() {
    if (this.currentIndex < this.slides.length - 1) {
      this.currentIndex++;
      this._render('next');
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this._render('prev');
    }
  }

  jumpTo(n) {
    const idx = Math.max(0, Math.min(this.slides.length - 1, n - 1));
    if (idx !== this.currentIndex) {
      this.currentIndex = idx;
      this._render('jump');
    }
  }

  first() { this.jumpTo(1); }
  last()  { this.jumpTo(this.slides.length); }

  toggleBlackout(force) {
    const active = (force !== undefined) ? force : !this.$blackout.classList.contains('active');
    this.$blackout.classList.toggle('active', active);
  }

  zoomIn()    { this.zoom = Math.min(this.zoom + 0.15, 3.0); this._applyZoom(); }
  zoomOut()   { this.zoom = Math.max(this.zoom - 0.15, 0.4); this._applyZoom(); }
  zoomReset() { this.zoom = 1; this._applyZoom(); }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.$stage.requestFullscreen?.()
        || this.$stage.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    }
  }

  setPenTool()   { this._setDrawMode('pen'); }
  setEraser()    { this._setDrawMode('eraser'); }
  setPointer()   { this._setDrawMode('pointer'); }

  setPenColor(color) { this._penColor = color; }
  setPenWidth(width) { this._penWidth = width; }

  toggleNotes() {
    const slide = this.slides[this.currentIndex];
    const notes = slide?.notes?.trim();
    if (!notes) { this.$notes.classList.remove('visible'); return; }
    this.$notes.textContent = notes;
    this.$notes.classList.toggle('visible');
  }

  togglePanel() {
    this.$panel.classList.toggle('hidden');
  }

  /**
   * Return a plain-text representation of the current slide's content.
   * Used by the TTS (Read Aloud) and AI analysis features.
   */
  getCurrentSlideText() {
    const slide = this.slides[this.currentIndex];
    if (!slide) return '';
    const parts = [];
    if (slide.title) parts.push(slide.title);
    if (slide.type === 'text') {
      (slide.bullets || []).forEach(b => parts.push(b.text));
    } else if (slide.type === 'table') {
      if (slide.headers) parts.push(slide.headers.join(' | '));
      (slide.rows || []).forEach(r => parts.push(r.join(' | ')));
    } else if (slide.type === 'image') {
      if (slide.notes) parts.push(slide.notes);
    }
    if (slide.notes && slide.type !== 'image') parts.push(slide.notes);
    return parts.filter(Boolean).join('. ');
  }

  /**
   * Return the current slide object (or null if no slides loaded).
   */
  getCurrentSlide() {
    return this.slides[this.currentIndex] || null;
  }

  // ── rendering ──────────────────────────────────────────────────────────

  _render(dir = 'jump') {
    const slide = this.slides[this.currentIndex];
    if (!slide) return;

    // save annotation
    if (this._annotCtx && this._annotCanvas) {
      this._annotations[this.currentIndex] =
        this._annotCtx.getImageData(0, 0, this._annotCanvas.width, this._annotCanvas.height);
    }

    // clear canvas
    this.$canvas.innerHTML = '';
    this._annotCanvas = null;
    this._annotCtx    = null;

    // build slide HTML
    let html = '';
    if (slide.type === 'image') {
      html = `<div class="slide-image-wrap"><img src="${slide.image}" alt="${_esc(slide.title)}"/></div>`;
    } else if (slide.type === 'table') {
      const headerCells = (slide.headers || []).map(h => `<th>${_esc(h)}</th>`).join('');
      const bodyRows    = (slide.rows || []).map(r =>
        `<tr>${r.map(c => `<td>${_esc(c)}</td>`).join('')}</tr>`
      ).join('');
      html = `
        <div class="slide-table-wrap">
          <div class="slide-table-title">${_esc(slide.title)}</div>
          <div class="slide-table-scroll">
            <table class="slide-table">
              <thead><tr>${headerCells}</tr></thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </div>
        </div>`;
    } else {
      // text slide
      const bullets = (slide.bullets || []).map(b =>
        `<li class="level-${b.level}">${_esc(b.text)}</li>`
      ).join('');
      html = `
        <div class="slide-content">
          <div class="slide-title">${_esc(slide.title)}</div>
          <ul class="slide-bullets">${bullets}</ul>
        </div>`;
    }

    this.$canvas.insertAdjacentHTML('beforeend', html);

    // animation
    const animated = this.$canvas.firstElementChild;
    if (animated) {
      animated.classList.add('slide-animate');
      animated.addEventListener('animationend', () => animated.classList.remove('slide-animate'), { once: true });
    }

    // restore annotation
    this._createAnnotCanvas();
    if (this._annotations[this.currentIndex] && this._annotCtx) {
      this._annotCtx.putImageData(this._annotations[this.currentIndex], 0, 0);
    }

    this._updateNav();
    this._updateThumbs();
    this.$notes.classList.remove('visible');
    this.onSlideChange(this.currentIndex + 1, this.slides.length);
  }

  _applyZoom() {
    this.$canvas.style.transform = `scale(${this.zoom})`;
  }

  // ── thumbnails ─────────────────────────────────────────────────────────

  _buildThumbs() {
    this.$panel.innerHTML = '';
    this.slides.forEach((slide, i) => {
      const div = document.createElement('div');
      div.className = 'thumb';
      div.dataset.index = i;

      let preview = '';
      if (slide.type === 'image') {
        preview = `<img src="${slide.image}" alt="" loading="lazy"/>`;
      } else if (slide.type === 'table') {
        preview = `<svg viewBox="0 0 60 34" width="60" xmlns="http://www.w3.org/2000/svg">
          <rect width="60" height="34" fill="#21262d"/>
          <rect x="2" y="2" width="56" height="8" fill="#30363d"/>
          <rect x="2" y="12" width="56" height="5" fill="#21262d"/>
          <rect x="2" y="19" width="56" height="5" fill="#21262d"/>
          <rect x="2" y="26" width="56" height="5" fill="#21262d"/>
        </svg>`;
      } else {
        const title = slide.title ? _esc(slide.title).substring(0, 20) : '';
        preview = `<svg viewBox="0 0 80 45" width="80" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
          <rect width="80" height="45" fill="#1e2228"/>
          <text x="4" y="11" font-size="7" fill="#e6edf3" font-family="sans-serif">${title}</text>
          <rect x="4" y="15" width="50" height="2" rx="1" fill="#8b949e" opacity=".5"/>
          <rect x="4" y="20" width="40" height="2" rx="1" fill="#8b949e" opacity=".4"/>
          <rect x="4" y="25" width="45" height="2" rx="1" fill="#8b949e" opacity=".3"/>
        </svg>`;
      }

      div.innerHTML = `
        <div class="thumb-number">${i + 1}</div>
        <div class="thumb-preview">${preview}</div>
        <div class="thumb-title">${_esc(slide.title || `Slide ${i + 1}`)}</div>`;

      div.addEventListener('click', () => this.jumpTo(i + 1));
      this.$panel.appendChild(div);
    });
  }

  _updateThumbs() {
    const thumbs = this.$panel.querySelectorAll('.thumb');
    thumbs.forEach((t, i) => t.classList.toggle('active', i === this.currentIndex));
    // scroll active thumb into view
    const active = this.$panel.querySelector('.thumb.active');
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  _updateNav() {
    this.$navPrev.disabled = this.currentIndex === 0;
    this.$navNext.disabled = this.currentIndex === this.slides.length - 1;
    this.$counter.textContent = `${this.currentIndex + 1} / ${this.slides.length}`;
  }

  // ── annotation canvas ──────────────────────────────────────────────────

  _createAnnotCanvas() {
    const c = document.createElement('canvas');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:20;touch-action:none;';
    c.width  = this.$canvas.offsetWidth  || 960;
    c.height = this.$canvas.offsetHeight || 540;
    this.$canvas.appendChild(c);
    this._annotCanvas = c;
    this._annotCtx    = c.getContext('2d');
    this._setupAnnotEvents(c);
  }

  _setupAnnotEvents(c) {
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return [
        ((src.clientX - r.left) / r.width)  * c.width,
        ((src.clientY - r.top)  / r.height) * c.height,
      ];
    };

    const start = (e) => {
      if (this._drawMode === 'pointer') return;
      e.preventDefault();
      this._drawing = true;
      [this._lastX, this._lastY] = pos(e);
    };
    const move = (e) => {
      if (!this._drawing || this._drawMode === 'pointer') return;
      e.preventDefault();
      const [x, y] = pos(e);
      const ctx = this._annotCtx;
      ctx.beginPath();
      ctx.moveTo(this._lastX, this._lastY);
      ctx.lineTo(x, y);
      if (this._drawMode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 20;
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = this._penWidth;
        ctx.strokeStyle = this._penColor;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      ctx.stroke();
      this._lastX = x;
      this._lastY = y;
    };
    const end = () => { this._drawing = false; };

    c.addEventListener('mousedown', start);
    c.addEventListener('mousemove', move);
    c.addEventListener('mouseup',   end);
    c.addEventListener('mouseleave',end);
    c.addEventListener('touchstart', start, { passive: false });
    c.addEventListener('touchmove',  move,  { passive: false });
    c.addEventListener('touchend',   end);
  }

  _setDrawMode(mode) {
    this._drawMode = mode;
    if (this._annotCanvas) {
      this._annotCanvas.style.cursor =
        mode === 'pen'    ? 'crosshair' :
        mode === 'eraser' ? 'cell'      : 'default';
    }
  }

  // ── keyboard ───────────────────────────────────────────────────────────

  _onKey(e) {
    if (!this.slides.length) return;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown':
        e.preventDefault(); this.next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
        e.preventDefault(); this.prev(); break;
      case 'Home': e.preventDefault(); this.first(); break;
      case 'End':  e.preventDefault(); this.last();  break;
      case 'b': case 'B': this.toggleBlackout(); break;
      case 'Escape': this.toggleBlackout(false); break;
      case 'f': case 'F': this.toggleFullscreen(); break;
    }
  }
}

// ── utility ──────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

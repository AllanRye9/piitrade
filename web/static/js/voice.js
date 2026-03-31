/**
 * voice.js – Web Speech API voice-command handler
 *
 * Mirrors the regex + fuzzy-matching logic from the original
 * yot_presentation_v5.3.1.py, adapted for the browser.
 *
 * Supported commands (all 8 languages from the original):
 *   next_slide, prev_slide, jump_slide, start_show, end_show,
 *   blackout, zoom_in, zoom_out, zoom_reset, fullscreen,
 *   first_slide, last_slide, pen_tool, eraser, pointer
 */

// ─── language definitions (mirrors LANGUAGE_CONFIGS) ──────────────────────
const LANG_CODES = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
  zh: 'zh-CN',
  ja: 'ja-JP',
};

// ─── command patterns (mirrors COMMAND_PATTERNS in app.py) ────────────────
const PATTERNS = [
  // jump_slide – must come first (has a capture group)
  {
    action: 'jump_slide',
    re: /(?:jump to|go to|slide|page|number|salta a|ve a|diapositiva|página|aller à|diapo|numéro|gehe zu|folie|seite|vai a|ir para|跳到|转到|幻灯片|スライド|ページ)\s*(\d+)/iu,
  },
  // next
  {
    action: 'next_slide',
    re: /\b(next|forward|advance|go forward|go right|siguiente|adelante|próxima|suivant|avancer|prochaine|nächst|vorwärts|prossimo|avanti|successivo|próximo|avançar|seguinte|下一张|下一个|向前|次へ|進む)\b/iu,
  },
  // previous
  {
    action: 'prev_slide',
    re: /\b(previous|prev|back|go back|return|anterior|atrás|volver|précédent|retour|zurück|vorherig|precedente|indietro|tornare|voltar|para trás|上一张|上一个|向后|戻る|前へ)\b/iu,
  },
  // start (long form first)
  {
    action: 'start_show',
    re: /\b(start presentation|begin show|present now|comenzar presentación|iniciar show|commencer présentation|débuter|präsentation starten|inizia presentazione|iniciar apresentação|开始演示|开始放映|プレゼンテーション開始|スライドショー開始)\b/iu,
  },
  // start (short form)
  {
    action: 'start_show',
    re: /\b(start|begin|present|play|iniciar|commencer|starten|iniziare|começar)\b/iu,
  },
  // end (long form)
  {
    action: 'end_show',
    re: /\b(stop presentation|end show|exit show|close presentation|detener presentación|arrêter présentation|quitter diaporama|präsentation beenden|ferma presentazione|parar apresentação|停止演示|退出幻灯片|プレゼンテーション終了|スライドショー終了)\b/iu,
  },
  // end (short form)
  {
    action: 'end_show',
    re: /\b(end|stop|exit|quit|close|terminar|finir|beenden|terminare)\b/iu,
  },
  // blackout
  {
    action: 'blackout',
    re: /\b(black|blackout|blank|darken|turn off screen|pantalla negra|oscurecer|écran noir|assombrir|schwarzer bildschirm|verdunkeln|schermo nero|scurire|tela preta|escurecer|黑屏|黒い画面|暗くする)\b/iu,
  },
  // zoom in
  {
    action: 'zoom_in',
    re: /\b(zoom in|magnify|enlarge|agrandir|vergrößern|ingrandire|ampliar|放大|ズームイン)\b/iu,
  },
  // zoom out
  {
    action: 'zoom_out',
    re: /\b(zoom out|shrink|reduce|réduire|verkleinern|rimpicciolire|縮小|ズームアウト)\b/iu,
  },
  // zoom reset
  {
    action: 'zoom_reset',
    re: /\b(reset zoom|normal size|actual size|zoom normal|rétablir zoom)\b/iu,
  },
  // fullscreen
  {
    action: 'fullscreen',
    re: /\b(fullscreen|full screen|maximize|présentation plein écran)\b/iu,
  },
  // first slide
  {
    action: 'first_slide',
    re: /\b(first slide|go to start|beginning|primera|première|erste folie)\b/iu,
  },
  // last slide
  {
    action: 'last_slide',
    re: /\b(last slide|final slide|end slide|última|dernière|letzte folie)\b/iu,
  },
  // pen tool
  {
    action: 'pen_tool',
    re: /\b(pen tool|draw|annotation|herramienta pluma|dibujar|outil stylo|dessiner|stiftwerkzeug|zeichnen|strumento penna|disegnare|ferramenta caneta|desenhar|笔工具|绘制|ペンツール|描画)\b/iu,
  },
  // eraser
  {
    action: 'eraser',
    re: /\b(eraser|erase|clear drawing|borrar|gomme|effacer|radiergummi|gomma)\b/iu,
  },
  // pointer
  {
    action: 'pointer',
    re: /\b(pointer|arrow|cursor|puntero|pointeur|zeiger|puntatore)\b/iu,
  },
];

/**
 * Match a transcript string against all command patterns.
 * Returns { action, slide? } or { action: 'unknown' }.
 */
export function matchCommand(text) {
  const t = text.toLowerCase().trim();
  for (const { action, re } of PATTERNS) {
    const m = t.match(re);
    if (m) {
      const result = { action, confidence: 0.95, text: t };
      if (action === 'jump_slide') result.slide = parseInt(m[1], 10);
      return result;
    }
  }
  return { action: 'unknown', confidence: 0, text: t };
}

// ─── VoiceController class ────────────────────────────────────────────────

export class VoiceController {
  /**
   * @param {Object} opts
   * @param {function(Object): void} opts.onCommand   Called with matched command object
   * @param {function(string): void} opts.onTranscript Called with raw interim transcript
   * @param {function(string): void} opts.onStatus    Called with status string
   * @param {string}  [opts.lang]                     BCP-47 language tag (default: en-US)
   * @param {boolean} [opts.continuous]               Keep listening after each command (default: true)
   */
  constructor({ onCommand, onTranscript, onStatus, lang = 'en-US', continuous = true }) {
    this.onCommand    = onCommand;
    this.onTranscript = onTranscript;
    this.onStatus     = onStatus;
    this.lang         = lang;
    this.continuous   = continuous;
    this._listening   = false;
    this._recog       = null;
    this._debounceId  = null;
  }

  get listening() { return this._listening; }
  get supported() { return ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window); }

  setLang(langCode) {
    this.lang = LANG_CODES[langCode] || langCode;
    if (this._listening) {
      this.stop();
      setTimeout(() => this.start(), 200);
    }
  }

  start() {
    if (!this.supported) {
      this.onStatus?.('⚠️ Speech recognition not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (this._listening) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SpeechRecognition();
    recog.lang = this.lang;
    recog.continuous = this.continuous;
    recog.interimResults = true;
    recog.maxAlternatives = 3;

    recog.onstart = () => {
      this._listening = true;
      this.onStatus?.('🎤 Listening…');
    };

    recog.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript   = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t;
        else interimTranscript += t;
      }

      const display = finalTranscript || interimTranscript;
      this.onTranscript?.(display);

      if (finalTranscript) {
        this._debounce(() => {
          const cmd = matchCommand(finalTranscript);
          this.onCommand?.(cmd);
        }, 120);
      }
    };

    recog.onerror = (event) => {
      const msg = {
        'no-speech':     'No speech detected. Please speak into your microphone and try again.',
        'audio-capture': 'Microphone not available. Check browser permissions and ensure a microphone is connected.',
        'not-allowed':   'Microphone access denied. Allow microphone access in your browser settings and reload.',
        'network':       'Network error. Check your internet connection.',
      }[event.error] || `Speech error: ${event.error}`;
      this.onStatus?.(`⚠️ ${msg}`);
      this._listening = false;
      // Disable auto-restart for fatal errors that won't resolve without user action
      if (event.error === 'audio-capture' || event.error === 'not-allowed') {
        this._shouldRestart = false;
      }
    };

    recog.onend = () => {
      this._listening = false;
      if (this.continuous && this._shouldRestart) {
        this._shouldRestart = false;
        setTimeout(() => this.start(), 300);
      } else {
        this.onStatus?.('Voice control stopped. Click microphone to restart.');
      }
    };

    this._recog = recog;
    this._shouldRestart = this.continuous;
    recog.start();
  }

  stop() {
    this._shouldRestart = false;
    this._listening = false;
    this._recog?.stop();
    this._recog = null;
    this.onStatus?.('Voice control stopped.');
  }

  toggle() {
    if (this._listening) this.stop();
    else this.start();
  }

  /** Restart automatically after recognition ends (e.g. browser time-out). */
  enableAutoRestart() {
    this._shouldRestart = true;
  }

  _debounce(fn, delay) {
    clearTimeout(this._debounceId);
    this._debounceId = setTimeout(fn, delay);
  }
}

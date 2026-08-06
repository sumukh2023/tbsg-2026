import QRCode from 'qrcode';
import type { PassData } from './PassCard';
import { PORTAL_CANONICAL } from '../pass/routes';

/**
 * Printing a pass, by building a DOCUMENT and printing that.
 *
 * WHY NOT `@media print` ON THE PAGE. The previous version hid the whole app
 * with `visibility: hidden` and lifted the pass out of it with `position:
 * fixed`, then collapsed html/body to zero height so the hidden content did
 * not paginate. Every one of those is a fight with the page's own CSS, and
 * whether you win it depends on the engine: Chromium's headless PDF path
 * rendered it correctly, which is exactly why it passed here, and real print
 * previews handed back a blank sheet. A zero-height body with `overflow:
 * hidden` is a reasonable thing for a browser to decide has nothing in it.
 *
 * An iframe has no such argument to lose. It gets its own document, its own
 * @page and its own stylesheet, inherits nothing from the app, and
 * `contentWindow.print()` prints exactly it. Chrome, Safari, Firefox and Edge
 * all do the same thing with that, because there is nothing left to disagree
 * about.
 *
 * The QR is regenerated here at print resolution rather than scaled up from
 * the one on screen: a 480px raster stretched across 55mm of paper is a
 * blurred code, and a blurred code does not scan.
 */

/** Escapes text going into the print document. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const VISITOR_LABELS: Record<string, string> = {
  student: 'Student',
  parent: 'Parent',
  other: 'Visitor',
};

function detail(label: string, value: string): string {
  return `
    <div class="field">
      <dt>${esc(label)}</dt>
      <dd>${esc(value)}</dd>
    </div>`;
}

/**
 * The faces the SITE is actually using, read off the live page rather than
 * written down here.
 *
 * A print stylesheet cannot use Tailwind, so it has to name a family, and a
 * named family is a second copy of a decision that already exists in
 * tailwind.config.ts. Copying the computed values means the printed pass uses
 * whatever the page uses and cannot drift from it the day the body face
 * changes. The stacks below are only the answer for a headless caller with no
 * document to ask.
 */
function faces(): { body: string; display: string } {
  const fallbackBody =
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
  const fallbackDisplay = 'Georgia, "Times New Roman", serif';
  try {
    const body = getComputedStyle(document.body).fontFamily || fallbackBody;
    const heading = document.querySelector('.font-display');
    const display = heading
      ? getComputedStyle(heading).fontFamily || fallbackDisplay
      : fallbackDisplay;
    return { body, display };
  } catch {
    return { body: fallbackBody, display: fallbackDisplay };
  }
}

function documentFor(pass: PassData, qr: string): string {
  const face = faces();
  const roll =
    pass.usn && pass.studentClass
      ? detail('USN', pass.usn) +
        detail('Class', `${pass.studentClass} ${pass.section ?? ''}`.trim())
      : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Flash @ Brigade 2026 · ${esc(pass.reference)}</title>
<style>
  /* A4 portrait with no margin of its own: the sheet's white space is the
     pass's own padding, so the layout is ours rather than the browser's
     default 1cm guess, which differs between engines. */
  @page { size: A4 portrait; margin: 0; }

  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    font-family: ${face.body};
    color: #251F18;
  }

  .sheet {
    width: 210mm;
    min-height: 297mm;
    padding: 24mm 20mm;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .card {
    width: 118mm;
    border: 0.4mm solid #E3DAC9;
    border-radius: 4mm;
    overflow: hidden;
    background: #FBF9F4;
  }

  /* The ticket's gold trim, as on screen. */
  .trim { height: 1mm; background: #A8842B; }

  .body { padding: 9mm 9mm 7mm; }

  .masthead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6mm;
  }
  .mark { width: 16mm; height: auto; display: block; }
  .brand {
    font-size: 2.6mm;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    color: #6B5B45;
    white-space: nowrap;
  }

  .title {
    margin: 7mm 0 0;
    font-family: ${face.display};
    font-style: italic;
    font-weight: 600;
    font-size: 9mm;
    line-height: 1.05;
    color: #251F18;
  }
  .when {
    margin: 2.5mm 0 0;
    font-size: 3mm;
    color: #6B5B45;
  }

  dl { margin: 8mm 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 5mm 6mm; }
  .field.wide { grid-column: 1 / -1; }
  dt {
    margin: 0 0 1.5mm;
    font-size: 2.5mm;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #7A6A52;
  }
  dd {
    margin: 0;
    font-size: 4mm;
    font-weight: 500;
    color: #251F18;
  }
  dd.name {
    font-family: ${face.display};
    font-size: 6.5mm;
    font-weight: 600;
  }

  .perforation {
    margin: 8mm 0 0;
    border-top: 0.3mm dashed #D8CDB8;
  }

  .qr-block { padding: 7mm 9mm 9mm; text-align: center; }
  /* White field and a full quiet zone: a scanner needs both, and the pass is
     read at a gate in whatever light there is. */
  .qr {
    width: 55mm;
    height: 55mm;
    display: block;
    margin: 0 auto;
    background: #ffffff;
    padding: 3mm;
    border-radius: 2mm;
    image-rendering: pixelated;
  }
  .reference {
    margin: 5mm 0 0;
    font-size: 3.6mm;
    font-weight: 600;
    letter-spacing: 0.22em;
    color: #251F18;
  }
  .instruction { margin: 2mm 0 0; font-size: 2.8mm; color: #6B5B45; }

  .footnote {
    margin: 10mm 0 0;
    text-align: center;
    font-size: 2.8mm;
    line-height: 1.6;
    color: #8A795F;
  }
</style>
</head>
<body>
  <main class="sheet">
    <article class="card">
      <div class="trim"></div>
      <div class="body">
        <div class="masthead">
          <svg class="mark" viewBox="40 20 660 360" aria-hidden="true">
            <path fill="#251F18" d="M 60 62 C 160 36 268 56 342 104 C 372 118 402 124 436 118 C 468 110 490 100 506 98 C 522 90 542 88 557 94 L 536 106 C 528 116 522 122 518 126 C 542 132 566 142 588 156 C 642 190 674 264 687 368 C 662 318 622 280 572 258 C 542 246 506 243 472 249 C 434 256 404 270 380 291 L 332 305 C 340 288 346 278 352 270 L 288 298 C 300 276 318 258 340 247 C 300 236 250 205 200 168 C 152 132 100 94 60 62 Z"/>
          </svg>
          <span class="brand">Flash @ Brigade</span>
        </div>

        <h1 class="title">Namma Mia Carpisa</h1>
        <p class="when">14 November 2026 · The Brigade School @ Malleswaram</p>

        <dl>
          <div class="field wide">
            <dt>Guest</dt>
            <dd class="name">${esc(pass.guestName)}</dd>
          </div>
          ${detail('Visitor type', VISITOR_LABELS[pass.visitorType] ?? 'Visitor')}
          ${detail('Passes', String(pass.numberOfPasses))}
          ${roll}
        </dl>
      </div>

      <div class="perforation"></div>

      <div class="qr-block">
        <img class="qr" src="${qr}" alt="">
        <p class="reference">${esc(pass.reference)}</p>
        <p class="instruction">Present this code at the gate</p>
      </div>
    </article>

    <p class="footnote">
      One pass per booking. Keep this with you on the day.<br>
      flashatbrigade &middot; The Brigade School @ Malleswaram
    </p>
  </main>
</body>
</html>`;
}

/**
 * Prints the pass. Resolves once the print dialog has been asked for, and
 * cleans the iframe up afterwards.
 *
 * The iframe is in the document rather than a popup on purpose: `window.open`
 * is blocked by default in several configurations, and a blocked popup is a
 * button that silently does nothing.
 */
export async function printPass(pass: PassData): Promise<void> {
  const url = `${window.location.origin}${PORTAL_CANONICAL}/${pass.token}`;
  // 1024px so a 55mm print at 300dpi has more pixels than it needs.
  const qr = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 1024,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  // Off-screen rather than display:none: a frame with no box does not lay
  // out, and Safari will happily print an empty one.
  frame.style.cssText =
    'position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(documentFor(pass, qr));
  doc.close();

  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    return;
  }

  // Wait for the QR image and, if they arrive, the webfonts. Printing before
  // the raster has decoded is the other way to get a blank pass.
  await new Promise<void>((resolve) => {
    let settled = false;
    const go = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    // A ceiling, so a slow font CDN can never hold the button hostage.
    const timer = win.setTimeout(go, 1500);
    const ready = async () => {
      try {
        const image = doc.querySelector('img');
        if (image && !image.complete) {
          await new Promise((r) => {
            image.onload = r;
            image.onerror = r;
          });
        }
        await doc.fonts?.ready;
      } catch {
        /* print anyway */
      }
      win.clearTimeout(timer);
      go();
    };
    if (doc.readyState === 'complete') void ready();
    else win.addEventListener('load', () => void ready(), { once: true });
  });

  win.focus();
  win.print();

  // Safari runs print() asynchronously, so the frame cannot go immediately.
  window.setTimeout(() => frame.remove(), 1000);
}

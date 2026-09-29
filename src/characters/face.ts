// Painted face decals for chibi characters (Hamin + NPCs). Drawn on a 256² canvas that is
// wrapped on a spherical patch in front of the head. See HAMIN_CHARACTER_BIBLE "Face decal expressions".

export type Expression =
  | 'neutral' | 'smile' | 'happy' | 'blink' | 'shy' | 'surprised' | 'scared'
  | 'eat' | 'sing' | 'tired' | 'wink' | 'determined' | 'love';

type EyeKind = 'open' | 'arc' | 'closed' | 'wide' | 'half' | 'heart' | 'x';
type MouthKind = 'smile' | 'open' | 'o' | 'wobble' | 'chew' | 'flat' | 'grin' | 'small';

interface FaceSpec {
  eyeL: EyeKind; eyeR: EyeKind; mouth: MouthKind; brow: number; browY: number; blush: number;
  sweat?: boolean; lookX?: number;
}

const SPECS: Record<Expression, FaceSpec> = {
  neutral: { eyeL: 'open', eyeR: 'open', mouth: 'small', brow: 0, browY: 0, blush: 0.35 },
  smile: { eyeL: 'arc', eyeR: 'arc', mouth: 'smile', brow: 0, browY: 0, blush: 0.5 },
  happy: { eyeL: 'arc', eyeR: 'arc', mouth: 'open', brow: 0, browY: -3, blush: 0.65 },
  blink: { eyeL: 'closed', eyeR: 'closed', mouth: 'small', brow: 0, browY: 0, blush: 0.35 },
  shy: { eyeL: 'open', eyeR: 'open', mouth: 'wobble', brow: -0.25, browY: 2, blush: 1, lookX: 7 },
  surprised: { eyeL: 'wide', eyeR: 'wide', mouth: 'o', brow: -0.1, browY: -8, blush: 0.3 },
  scared: { eyeL: 'wide', eyeR: 'wide', mouth: 'wobble', brow: -0.45, browY: -5, blush: 0.2, sweat: true },
  eat: { eyeL: 'arc', eyeR: 'arc', mouth: 'chew', brow: -0.1, browY: 0, blush: 0.85 },
  sing: { eyeL: 'closed', eyeR: 'closed', mouth: 'o', brow: -0.15, browY: -3, blush: 0.55 },
  tired: { eyeL: 'half', eyeR: 'half', mouth: 'flat', brow: -0.3, browY: 3, blush: 0.25, sweat: true },
  wink: { eyeL: 'open', eyeR: 'arc', mouth: 'grin', brow: 0, browY: 0, blush: 0.6 },
  determined: { eyeL: 'open', eyeR: 'open', mouth: 'flat', brow: 0.4, browY: 2, blush: 0.3 },
  love: { eyeL: 'heart', eyeR: 'heart', mouth: 'open', brow: -0.1, browY: -3, blush: 0.9 },
};

export interface FaceStyle {
  eyeColor: string;
  eyeGap: number; // px from centre
  eyeY: number;
  eyeW: number;
  eyeH: number;
  mouthY: number;
  brows: boolean;
  browColor: string;
  blushColor: string;
  skin?: string; // fill background (NPCs use transparent)
}

export const HAMIN_FACE: FaceStyle = {
  eyeColor: '#3A3048', eyeGap: 47, eyeY: 156, eyeW: 19, eyeH: 25, mouthY: 196,
  brows: true, browColor: '#2B2A33', blushColor: '#FFA7B8',
};

export function drawFace(g: CanvasRenderingContext2D, expr: Expression, st: FaceStyle, W = 256) {
  const s = W / 256;
  g.save();
  g.clearRect(0, 0, W, W);
  g.scale(s, s);
  const sp = SPECS[expr];
  const cx = 128;
  const ey = st.eyeY;
  // blush
  if (sp.blush > 0) {
    g.globalAlpha = 0.25 + sp.blush * 0.6;
    g.fillStyle = st.blushColor;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + sx * (st.eyeGap + 18), ey + 26, 17, 10, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    if (sp.blush > 0.8) {
      g.strokeStyle = '#FF8FA8';
      g.lineWidth = 2.5;
      for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
        const x = cx + sx * (st.eyeGap + 10) + i * 7;
        g.beginPath(); g.moveTo(x, ey + 22); g.lineTo(x - 4, ey + 30); g.stroke();
      }
    }
  }
  // eyes
  eye(g, sp.eyeL, cx - st.eyeGap, ey, st, sp.lookX ?? 0, -1);
  eye(g, sp.eyeR, cx + st.eyeGap, ey, st, sp.lookX ?? 0, 1);
  // brows
  if (st.brows) {
    g.strokeStyle = st.browColor;
    g.lineWidth = 5;
    g.lineCap = 'round';
    for (const sx of [-1, 1]) {
      const bx = cx + sx * st.eyeGap;
      const by = ey - st.eyeH - 16 + sp.browY;
      g.beginPath();
      g.moveTo(bx - sx * 12, by + sp.brow * 10);
      g.quadraticCurveTo(bx, by - 5, bx + sx * 12, by - sp.brow * 4);
      g.stroke();
    }
  }
  mouth(g, sp.mouth, cx, st.mouthY);
  if (sp.sweat) {
    g.fillStyle = '#9CD3FF';
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx + st.eyeGap + 34, ey - 36);
    g.quadraticCurveTo(cx + st.eyeGap + 44, ey - 18, cx + st.eyeGap + 34, ey - 12);
    g.quadraticCurveTo(cx + st.eyeGap + 24, ey - 18, cx + st.eyeGap + 34, ey - 36);
    g.fill();
    g.stroke();
  }
  g.restore();
}

function eye(g: CanvasRenderingContext2D, k: EyeKind, x: number, y: number, st: FaceStyle, look: number, side: number) {
  g.fillStyle = st.eyeColor;
  g.strokeStyle = st.eyeColor;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const w = st.eyeW, h = st.eyeH;
  switch (k) {
    case 'open':
    case 'wide': {
      const ww = k === 'wide' ? w * 1.2 : w;
      const hh = k === 'wide' ? h * 1.15 : h;
      g.beginPath();
      g.ellipse(x + look, y, ww, hh, 0, 0, Math.PI * 2);
      g.fill();
      // iris gradient
      const grd = g.createLinearGradient(0, y - hh, 0, y + hh);
      grd.addColorStop(0, 'rgba(90,70,110,0)');
      grd.addColorStop(1, 'rgba(150,120,170,0.55)');
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(x + look, y + hh * 0.25, ww * 0.8, hh * 0.65, 0, 0, Math.PI * 2);
      g.fill();
      // soft upper lash line
      g.strokeStyle = st.eyeColor;
      g.lineWidth = 4.5;
      g.beginPath();
      g.ellipse(x + look, y - 1, ww * 1.12, hh * 1.02, 0, Math.PI * 1.08, Math.PI * 1.92);
      g.stroke();
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(x + look - ww * 0.3, y - hh * 0.36, ww * (k === 'wide' ? 0.3 : 0.46), hh * 0.34, -0.3, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.9;
      g.beginPath();
      g.arc(x + look + ww * 0.3, y - hh * 0.55, ww * 0.14, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(x + look + ww * 0.38, y + hh * 0.38, ww * 0.18, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'arc':
      g.lineWidth = 6;
      g.beginPath();
      g.arc(x, y + 6, w * 1.05, Math.PI * 1.12, Math.PI * 1.88);
      g.stroke();
      break;
    case 'closed':
      g.lineWidth = 5.5;
      g.beginPath();
      g.arc(x, y - 8, w * 1.05, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
      break;
    case 'half':
      g.beginPath();
      g.ellipse(x, y + 4, w, h * 0.55, 0, 0, Math.PI);
      g.fill();
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x - w - 3, y + 2);
      g.lineTo(x + w + 3, y + 2);
      g.stroke();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(x - w * 0.3, y + 8, 3.5, 0, Math.PI * 2);
      g.fill();
      break;
    case 'heart': {
      g.fillStyle = '#FF7A93';
      const s = w * 2.6;
      g.beginPath();
      const hx = x, hy = y - s * 0.45;
      g.moveTo(hx, hy + s * 0.3);
      g.bezierCurveTo(hx, hy, hx - s * 0.5, hy, hx - s * 0.5, hy + s * 0.3);
      g.bezierCurveTo(hx - s * 0.5, hy + s * 0.6, hx, hy + s * 0.75, hx, hy + s * 0.95);
      g.bezierCurveTo(hx, hy + s * 0.75, hx + s * 0.5, hy + s * 0.6, hx + s * 0.5, hy + s * 0.3);
      g.bezierCurveTo(hx + s * 0.5, hy, hx, hy, hx, hy + s * 0.3);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(hx - s * 0.22, hy + s * 0.3, 3.5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'x':
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x - w, y - w); g.lineTo(x + w, y + w);
      g.moveTo(x + w, y - w); g.lineTo(x - w, y + w);
      g.stroke();
      break;
  }
  void side;
}

function mouth(g: CanvasRenderingContext2D, k: MouthKind, x: number, y: number) {
  g.strokeStyle = '#8A4B5C';
  g.fillStyle = '#E86A86';
  g.lineWidth = 4.5;
  g.lineCap = 'round';
  switch (k) {
    case 'small':
      g.beginPath();
      g.arc(x, y - 6, 8, Math.PI * 0.25, Math.PI * 0.75);
      g.stroke();
      break;
    case 'smile':
      g.beginPath();
      g.arc(x, y - 10, 13, Math.PI * 0.2, Math.PI * 0.8);
      g.stroke();
      break;
    case 'grin':
      g.beginPath();
      g.moveTo(x - 12, y - 3);
      g.quadraticCurveTo(x, y + 10, x + 12, y - 3);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    case 'open':
      g.beginPath();
      g.moveTo(x - 13, y - 5);
      g.quadraticCurveTo(x, y + 20, x + 13, y - 5);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#FFB0C0';
      g.beginPath();
      g.ellipse(x, y + 5, 6, 3.5, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case 'o':
      g.beginPath();
      g.ellipse(x, y, 7, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      break;
    case 'wobble':
      g.beginPath();
      g.moveTo(x - 13, y);
      for (let i = 0; i <= 4; i++) g.lineTo(x - 13 + i * 6.5, y + (i % 2 ? -4 : 3));
      g.stroke();
      break;
    case 'chew':
      g.beginPath();
      g.arc(x - 6, y - 3, 6, 0, Math.PI);
      g.arc(x + 6, y - 3, 6, 0, Math.PI);
      g.stroke();
      break;
    case 'flat':
      g.beginPath();
      g.moveTo(x - 9, y);
      g.lineTo(x + 9, y);
      g.stroke();
      break;
  }
}

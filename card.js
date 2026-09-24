const CARD_WIDTH = 720;
const CARD_HEIGHT = 960;
const COLORS = { cream: '#f6f3e9', ink: '#202220', lime: '#d9f863', coral: '#ff775e', lavender: '#ddd0f9' };
const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif';

function rounded(ctx, x, y, w, h, radius, fill, stroke = null, lineWidth = 3) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function text(ctx, value, x, y, size, color = COLORS.ink, weight = 700, align = 'left', maxWidth = null) {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  let fittedSize = size;
  ctx.font = `${weight} ${fittedSize}px ${FONT}`;
  if (maxWidth) {
    while (ctx.measureText(String(value)).width > maxWidth && fittedSize > 14) {
      fittedSize -= 1;
      ctx.font = `${weight} ${fittedSize}px ${FONT}`;
    }
  }
  ctx.fillText(String(value), x, y);
}

function spark(ctx, x, y, size, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const radius = i % 2 ? size * 0.27 : size;
    const px = Math.cos(a) * radius;
    const py = Math.sin(a) * radius;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

async function loadCat() {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 5000);
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = new URL('./assets/cat-smug.svg', import.meta.url).href;
  });
}

function fallbackCat(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.moveTo(-85, -32); ctx.lineTo(-73, -100); ctx.lineTo(-33, -58);
  ctx.quadraticCurveTo(0, -74, 33, -58);
  ctx.lineTo(73, -100); ctx.lineTo(85, -32);
  ctx.bezierCurveTo(111, 68, -111, 68, -85, -32);
  ctx.fill();
  ctx.strokeStyle = COLORS.cream; ctx.lineWidth = 7; ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * 38 - 17, -8);
    ctx.quadraticCurveTo(side * 38, -23, side * 38 + 17, -8); ctx.stroke();
  }
  ctx.fillStyle = COLORS.coral; ctx.beginPath();
  ctx.ellipse(0, 19, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Create a portable, dependency-free PNG preview/download of a completed run. */
export async function makeScoreCard({ score = 0, rankName = '天生反骨', correct = 0, maxCombo = 0, url = '', seed = '' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器无法生成成绩卡');
  const numeric = (value) => Math.max(0, Math.floor(Number(value) || 0));
  let shortUrl;
  try {
    const target = new URL(url || location.href, location.href);
    shortUrl = target.host + target.pathname.replace(/\/$/, '');
  } catch { shortUrl = '反骨小猫 · 点开链接挑战'; }
  const cat = await loadCat();
  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  // A printed card with off-register sticker accents.
  rounded(ctx, 28, 28, 664, 904, 30, COLORS.cream, COLORS.ink, 3);
  rounded(ctx, 53, 53, 176, 38, 19, COLORS.lime, COLORS.ink, 2);
  text(ctx, '不听话俱乐部', 141, 80, 20, COLORS.ink, 800, 'center');
  text(ctx, '30 秒反骨挑战', 657, 79, 20, COLORS.ink, 600, 'right');
  text(ctx, '反骨小猫', 57, 157, 61, COLORS.ink, 900);
  text(ctx, '它说左，你偏右。', 60, 201, 25, COLORS.ink, 600);
  spark(ctx, 622, 160, 30, COLORS.coral);
  ctx.save();
  ctx.translate(358, 418);
  ctx.rotate(-0.025);
  rounded(ctx, -293, -170, 586, 350, 26, COLORS.lime, COLORS.ink, 3);
  ctx.restore();
  text(ctx, '本喵的反骨值', 95, 291, 24, COLORS.ink, 700);
  text(ctx, numeric(score), 93, 443, 142, COLORS.ink, 900, 'left', 335);
  text(ctx, '分', 105, 486, 22, COLORS.ink, 700);
  if (cat) ctx.drawImage(cat, 390, 306, 255, 255);
  else fallbackCat(ctx, 520, 437);
  spark(ctx, 597, 292, 19, COLORS.lavender);
  rounded(ctx, 92, 516, 340, 50, 25, COLORS.ink);
  text(ctx, String(rankName || '天生反骨'), 262, 551, 28, COLORS.cream, 800, 'center', 305);
  rounded(ctx, 65, 622, 279, 111, 19, '#ffffff', COLORS.ink, 2);
  rounded(ctx, 376, 622, 279, 111, 19, COLORS.lavender, COLORS.ink, 2);
  text(ctx, numeric(correct), 98, 675, 42, COLORS.ink, 900, 'left', 200);
  text(ctx, '次成功反骨', 100, 707, 19, COLORS.ink, 600);
  text(ctx, numeric(maxCombo), 409, 675, 42, COLORS.ink, 900, 'left', 200);
  text(ctx, '最高连击', 411, 707, 19, COLORS.ink, 600);
  text(ctx, '你能比我更不听话吗？', 360, 796, 31, COLORS.ink, 800, 'center');
  text(ctx, '30 秒一局 · 点开就能挑战', 360, 835, 22, COLORS.ink, 500, 'center');
  rounded(ctx, 66, 862, 589, 42, 21, COLORS.ink);
  text(ctx, shortUrl, 360, 890, 18, COLORS.cream, 600, 'center', 540);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('成绩卡生成失败，请重试')), 'image/png');
  });
  return { blob, dataUrl: canvas.toDataURL('image/png') };
}

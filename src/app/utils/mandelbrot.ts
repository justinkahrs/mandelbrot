export function renderMandelbrot(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  maxIter: number,
  hueShift: number
) {
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  for (let px = 0; px < width; px++) {
    for (let py = 0; py < height; py++) {
      let x0 = xMin + (px / width) * (xMax - xMin);
      let y0 = yMin + (py / height) * (yMax - yMin);
      let x = 0, y = 0, iter = 0;
      while (x * x + y * y <= 4 && iter < maxIter) {
        let xTemp = x * x - y * y + x0;
        y = 2 * x * y + y0;
        x = xTemp;
        iter++;
      }
      let idx = (py * width + px) * 4;
      const ratio = iter / maxIter;
      const hue = ((ratio * 360) + hueShift) % 360;
      const c = hslToRgb(hue / 360, 1, 0.5);
      data[idx] = c.r;
      data[idx + 1] = c.g;
      data[idx + 2] = c.b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function hslToRgb(h: number, s: number, l: number) {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  };
}
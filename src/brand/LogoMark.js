export function drawBrakeLabMark(context) {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const size = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const scale = size / 256;

  context.clearRect(0, 0, width, height);
  context.fillStyle = '#e34f39';
  context.beginPath();
  context.arc(cx, cy, size * 0.46, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#f8e9bc';
  context.lineWidth = 8 * scale;
  context.beginPath();
  context.arc(cx, cy, size * 0.415, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = '#f7d94c';
  context.fillRect(cx - 47 * scale, cy - 67 * scale, 94 * scale, 65 * scale);
  context.fillRect(cx - 12 * scale, cy - 2 * scale, 24 * scale, 83 * scale);
  context.fillRect(cx - 67 * scale, cy + 78 * scale, 134 * scale, 15 * scale);
  context.fillStyle = '#27313a';
  for (const offset of [-21, 0, 21]) {
    context.fillRect(cx - 34 * scale, cy - 43 * scale + offset * scale, 68 * scale, 5 * scale);
  }
}

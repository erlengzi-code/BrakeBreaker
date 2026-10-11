import { analyzeDrawing, fingerprintDrawing } from './EnchantmentSystem.js';
import { drawBrakeLabMark } from '../brand/LogoMark.js';

const BACKGROUND = '#f5e8bd';

export class LogoCanvas {
  constructor(canvas, onChange) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.onChange = onChange;
    this.color = '#121a22';
    this.brushSize = 10;
    this.strokes = [];
    this.activeStroke = null;
    this.revision = 0;
    this.blankHasDefault = false;
    this.canvas.width = 384;
    this.canvas.height = 384;
    this.clearSurface();
    this.bind();
  }

  bind() {
    this.canvas.addEventListener('pointerdown', (event) => this.startStroke(event));
    this.canvas.addEventListener('pointermove', (event) => this.extendStroke(event));
    this.canvas.addEventListener('pointerup', () => this.finishStroke());
    this.canvas.addEventListener('pointercancel', () => this.finishStroke());
    this.canvas.addEventListener('pointerleave', () => this.finishStroke());
  }

  getPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * this.canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * this.canvas.height,
    };
  }

  startStroke(event) {
    event.preventDefault();
    this.canvas.setPointerCapture?.(event.pointerId);
    if (this.strokes.length === 0 && this.blankHasDefault) this.clearSurface();
    const point = this.getPoint(event);
    this.activeStroke = { color: this.color, size: this.brushSize, points: [point] };
    this.strokes.push(this.activeStroke);
    this.drawDot(point, this.activeStroke);
  }

  extendStroke(event) {
    if (!this.activeStroke) return;
    event.preventDefault();
    const point = this.getPoint(event);
    const previous = this.activeStroke.points.at(-1);
    this.activeStroke.points.push(point);
    this.drawSegment(previous, point, this.activeStroke);
  }

  finishStroke() {
    if (!this.activeStroke) return;
    this.activeStroke = null;
    this.revision += 1;
    this.emitChange();
  }

  drawDot(point, stroke) {
    this.context.fillStyle = stroke.color;
    this.context.beginPath();
    this.context.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
    this.context.fill();
  }

  drawSegment(from, to, stroke) {
    this.context.strokeStyle = stroke.color;
    this.context.lineWidth = stroke.size;
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';
    this.context.beginPath();
    this.context.moveTo(from.x, from.y);
    this.context.lineTo(to.x, to.y);
    this.context.stroke();
  }

  setColor(color) {
    this.color = color;
  }

  setBrushSize(size) {
    this.brushSize = Math.max(3, Math.min(24, Number(size) || 10));
  }

  clear() {
    this.strokes = [];
    this.activeStroke = null;
    this.revision += 1;
    this.redraw();
    this.emitChange();
  }

  undo() {
    if (this.strokes.length === 0) return false;
    this.strokes.pop();
    this.activeStroke = null;
    this.revision += 1;
    this.redraw();
    this.emitChange();
    return true;
  }

  redraw() {
    if (this.strokes.length === 0 && this.blankHasDefault) {
      this.drawDefaultLogo();
      return;
    }
    this.clearSurface();
    this.strokes.forEach((stroke) => {
      stroke.points.forEach((point, index) => {
        if (index === 0) this.drawDot(point, stroke);
        else this.drawSegment(stroke.points[index - 1], point, stroke);
      });
    });
  }

  clearSurface() {
    this.context.fillStyle = BACKGROUND;
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.strokeStyle = 'rgba(20, 28, 34, .13)';
    this.context.lineWidth = 2;
    this.context.beginPath();
    const center = this.canvas.width / 2;
    this.context.arc(center, center, this.canvas.width * 0.40625, 0, Math.PI * 2);
    this.context.stroke();
  }

  drawDefaultLogo() {
    this.clearSurface();
    this.blankHasDefault = true;
    drawBrakeLabMark(this.context);
  }

  prepareForEnchant() {
    const features = this.getFeatures();
    if (features.blank) this.drawDefaultLogo();
    return {
      features,
      fingerprint: fingerprintDrawing(this.strokes),
      dataUrl: this.canvas.toDataURL('image/png'),
      revision: this.revision,
    };
  }

  getFeatures() {
    return analyzeDrawing(this.strokes, this.canvas.width, this.canvas.height);
  }

  emitChange() {
    this.onChange?.({
      dataUrl: this.canvas.toDataURL('image/png'),
      features: this.getFeatures(),
      fingerprint: fingerprintDrawing(this.strokes),
      revision: this.revision,
      canUndo: this.strokes.length > 0,
    });
  }
}

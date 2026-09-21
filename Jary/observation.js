const POINT_COUNT = 72;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function buildBehaviorTrace(width, height, phase = 0) {
  const safeWidth = Math.max(0, width);
  const safeHeight = Math.max(0, height);
  const padding = Math.min(24, safeHeight * 0.08);
  const amplitude = Math.max(0, safeHeight * 0.27);

  return Array.from({ length: POINT_COUNT }, (_, index) => {
    const progress = index / (POINT_COUNT - 1);
    const primary = Math.sin(progress * Math.PI * 5.4 + phase * 2.1);
    const secondary = Math.sin(progress * Math.PI * 15.7 - phase * 1.3) * 0.25;
    const event = Math.exp(-Math.pow((progress - 0.68) * 11, 2)) * 0.7;
    const y = safeHeight * 0.52 - (primary * 0.46 + secondary + event) * amplitude;

    return {
      x: progress * safeWidth,
      y: clamp(y, padding, Math.max(padding, safeHeight - padding)),
    };
  });
}

export function createObservationPlate(canvas, options = {}) {
  const context = canvas?.getContext?.('2d');
  if (!context) return null;

  const windowRef = options.windowRef ?? window;
  const reducedMotion = options.reducedMotion
    ?? windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ?? false;
  const pixelRatio = Math.min(options.pixelRatio ?? windowRef.devicePixelRatio ?? 1, 2);
  let width = 0;
  let height = 0;

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(320, Math.round(bounds.width));
    height = Math.max(300, Math.round(bounds.height));
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    draw(0);
  }

  function draw() {
    const phase = 0.2;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#e9e9e7';
    context.fillRect(0, 0, width, height);

    context.lineWidth = 1;
    context.strokeStyle = 'rgba(32, 32, 32, 0.12)';
    for (let x = 32; x < width; x += 48) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 32; y < height; y += 48) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    const centerX = width * 0.54;
    const centerY = height * 0.47;
    context.strokeStyle = 'rgba(22, 22, 22, 0.2)';
    for (const radius of [58, 108, 164]) {
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.stroke();
    }

    const trace = buildBehaviorTrace(width + 40, height * 0.72, phase);
    context.save();
    context.translate(-20, height * 0.12);
    context.lineWidth = 2;
    context.strokeStyle = '#a6192e';
    context.beginPath();
    trace.forEach(({ x, y }, index) => {
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();

    context.fillStyle = '#111111';
    [9, 28, 48, 61].forEach((index) => {
      const point = trace[index];
      context.beginPath();
      context.arc(point.x, point.y, 4, 0, Math.PI * 2);
      context.fill();
    });
    context.restore();

    context.fillStyle = 'rgba(20, 20, 20, 0.8)';
    context.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText('CONCEPTUAL TRACE / SUBJECT JARY', 22, 26);
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(resize)
    : null;

  resizeObserver?.observe(canvas);
  windowRef.addEventListener?.('resize', resize, { passive: true });
  resize();

  return {
    resize,
    draw,
    destroy() {
      resizeObserver?.disconnect();
      windowRef.removeEventListener?.('resize', resize);
    },
  };
}

if (typeof document !== 'undefined') {
  const canvas = document.querySelector('#behavior-canvas');
  if (canvas) createObservationPlate(canvas);
}

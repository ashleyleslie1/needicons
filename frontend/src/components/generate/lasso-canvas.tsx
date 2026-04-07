import { useRef, useState, useEffect, useCallback } from "react";

interface LassoCanvasProps {
  imageSrc: string;
  mode: "remove" | "protect";
  zoom: number;
  onComplete: (polygon: [number, number][]) => void;
  disabled?: boolean;
}

/**
 * Compute Sobel gradient magnitude from image pixel data.
 * Returns a Float32Array of same dimensions with gradient magnitudes.
 */
function computeGradientMap(imageData: ImageData): Float32Array {
  const { width, height, data } = imageData;
  const gray = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const gradient = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx =
        -gray[(y - 1) * width + (x - 1)] +
        gray[(y - 1) * width + (x + 1)] -
        2 * gray[y * width + (x - 1)] +
        2 * gray[y * width + (x + 1)] -
        gray[(y + 1) * width + (x - 1)] +
        gray[(y + 1) * width + (x + 1)];
      const gy =
        -gray[(y - 1) * width + (x - 1)] -
        2 * gray[(y - 1) * width + x] -
        gray[(y - 1) * width + (x + 1)] +
        gray[(y + 1) * width + (x - 1)] +
        2 * gray[(y + 1) * width + x] +
        gray[(y + 1) * width + (x + 1)];
      gradient[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  return gradient;
}

/**
 * Dijkstra shortest path between two points on the gradient map.
 * Cost = max_gradient - gradient (high-gradient edges are cheap to follow).
 */
function magneticPath(
  gradient: Float32Array,
  width: number,
  height: number,
  start: [number, number],
  end: [number, number],
  maxSteps: number = 5000,
): [number, number][] {
  const [sx, sy] = start;
  const [ex, ey] = end;

  const dist = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
  if (dist < 3) return [start, end];

  let maxGrad = 1;
  for (let i = 0; i < gradient.length; i++) {
    if (gradient[i] > maxGrad) maxGrad = gradient[i];
  }

  const INF = 1e18;
  const costs = new Float32Array(width * height).fill(INF);
  const prev = new Int32Array(width * height).fill(-1);
  const visited = new Uint8Array(width * height);

  const pq: [number, number][] = [];
  const startIdx = sy * width + sx;
  const endIdx = ey * width + ex;
  costs[startIdx] = 0;
  pq.push([0, startIdx]);

  const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy = [-1, -1, -1, 0, 0, 1, 1, 1];
  const dcost = [1.414, 1, 1.414, 1, 1, 1.414, 1, 1.414];

  let steps = 0;
  while (pq.length > 0 && steps < maxSteps) {
    steps++;
    let minIdx = 0;
    for (let i = 1; i < pq.length; i++) {
      if (pq[i][0] < pq[minIdx][0]) minIdx = i;
    }
    const [, curIdx] = pq[minIdx];
    pq.splice(minIdx, 1);

    if (visited[curIdx]) continue;
    visited[curIdx] = 1;

    if (curIdx === endIdx) break;

    const cx = curIdx % width;
    const cy = Math.floor(curIdx / width);

    for (let d = 0; d < 8; d++) {
      const nx = cx + dx[d];
      const ny = cy + dy[d];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (visited[nIdx]) continue;

      const edgeCost = (maxGrad - gradient[nIdx] + 1) * dcost[d];
      const newCost = costs[curIdx] + edgeCost;

      if (newCost < costs[nIdx]) {
        costs[nIdx] = newCost;
        prev[nIdx] = curIdx;
        pq.push([newCost, nIdx]);
      }
    }
  }

  const path: [number, number][] = [];
  let idx = endIdx;
  while (idx !== -1 && idx !== startIdx) {
    path.push([idx % width, Math.floor(idx / width)]);
    idx = prev[idx];
  }
  path.push(start);
  path.reverse();

  return path;
}

export function LassoCanvas({
  imageSrc,
  mode,
  zoom,
  onComplete,
  disabled,
}: LassoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gradientRef = useRef<Float32Array | null>(null);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [segments, setSegments] = useState<[number, number][][]>([]);
  const [hoverPath, setHoverPath] = useState<[number, number][]>([]);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);

  // Load image and compute gradient map
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      gradientRef.current = computeGradientMap(imageData);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setReady(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const strokeColor = mode === "remove" ? "#ff3c3c" : "#3c78ff";
    const fillColor = mode === "remove" ? "rgba(255, 60, 60, 0.5)" : "rgba(60, 120, 255, 0.5)";

    // Draw completed segments
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    for (const seg of segments) {
      if (seg.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(seg[0][0], seg[0][1]);
      for (let i = 1; i < seg.length; i++) {
        ctx.lineTo(seg[i][0], seg[i][1]);
      }
      ctx.stroke();
    }

    // Draw hover path
    if (hoverPath.length > 1) {
      ctx.strokeStyle = strokeColor;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hoverPath[0][0], hoverPath[0][1]);
      for (let i = 1; i < hoverPath.length; i++) {
        ctx.lineTo(hoverPath[i][0], hoverPath[i][1]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw points
    for (let i = 0; i < points.length; i++) {
      const [px, py] = points[i];
      ctx.beginPath();
      ctx.arc(px, py, i === 0 ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? strokeColor : fillColor;
      ctx.fill();
      if (i === 0) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.lineWidth = 2;
      }
    }
  }, [segments, hoverPath, points, mode, ready]);

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent): [number, number] | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return [
        Math.round((e.clientX - rect.left) * scaleX),
        Math.round((e.clientY - rect.top) * scaleY),
      ];
    },
    [],
  );

  const finishPolygon = useCallback(
    (allSegments: [number, number][][]) => {
      const polygon: [number, number][] = [];
      for (const seg of allSegments) {
        for (const pt of seg) {
          polygon.push([pt[0] / imgSize.w, pt[1] / imgSize.h]);
        }
      }
      onComplete(polygon);
      setPoints([]);
      setSegments([]);
      setHoverPath([]);
    },
    [imgSize, onComplete],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || !ready || !gradientRef.current) return;
      const coords = getCanvasCoords(e);
      if (!coords) return;
      const [x, y] = coords;

      // Close polygon if clicking near start point
      if (points.length >= 3) {
        const [sx, sy] = points[0];
        const dist = Math.sqrt((x - sx) ** 2 + (y - sy) ** 2);
        if (dist < 10) {
          const closingPath = magneticPath(
            gradientRef.current, imgSize.w, imgSize.h,
            points[points.length - 1], points[0],
          );
          finishPolygon([...segments, closingPath]);
          return;
        }
      }

      // Add point with magnetic path from last point
      if (points.length > 0) {
        const lastPoint = points[points.length - 1];
        const path = magneticPath(
          gradientRef.current, imgSize.w, imgSize.h,
          lastPoint, [x, y],
        );
        setSegments((prev) => [...prev, path]);
      }
      setPoints((prev) => [...prev, [x, y]]);
      setHoverPath([]);
    },
    [disabled, ready, points, segments, imgSize, getCanvasCoords, finishPolygon],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || !ready || !gradientRef.current || points.length < 3) return;
      e.preventDefault();
      const closingPath = magneticPath(
        gradientRef.current, imgSize.w, imgSize.h,
        points[points.length - 1], points[0],
      );
      finishPolygon([...segments, closingPath]);
    },
    [disabled, ready, points, segments, imgSize, finishPolygon],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || !ready || !gradientRef.current || points.length === 0) return;
      const coords = getCanvasCoords(e);
      if (!coords) return;
      const lastPoint = points[points.length - 1];
      const path = magneticPath(
        gradientRef.current, imgSize.w, imgSize.h,
        lastPoint, coords, 2000,
      );
      setHoverPath(path);
    },
    [disabled, ready, points, imgSize, getCanvasCoords],
  );

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-20"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        cursor: disabled ? "default" : "crosshair",
        transform: `scale(${zoom})`,
        pointerEvents: disabled ? "none" : "auto",
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
    />
  );
}

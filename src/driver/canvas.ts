import xs, {Stream} from 'xstream';
import {adapt} from '@cycle/run/lib/adapt';

type Rect = {
  x: number,
  y: number,
  width: number,
  height: number,
  strike: number,
  color: string
};
type Circle = {
  x: number,
  y: number,
  radius: number,
  color: string,
  strike: number
};
type Drawing = Rect | Circle;

type CanvasDescription = {
  id: string,
  drawings: Drawing[]
};

function isCircle(d: Drawing): d is Circle {
  return (d as Circle).radius !== undefined;
}

function isRect(d: Drawing): d is Rect {
  return (d as Rect).width !== undefined
    && (d as Rect).height !== undefined;
}

const clearCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

const drawCanvas = (ctx: CanvasRenderingContext2D, actions: Drawing[]) => {
  actions.forEach(d => {
    if (isCircle(d)) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.lineWidth = d.strike;
      ctx.strokeStyle = "black";
      ctx.stroke();
    } else if (isRect(d)) {
      ctx.strokeStyle = d.color;
      ctx.lineWidth = d.strike;
      ctx.strokeRect(d.x, d.y, d.width, d.height);
    }
  });
};

const getCanvas = (canvasId: string): HTMLCanvasElement | null => {
  const element = document.getElementById(canvasId);
  return element && element.nodeName === 'CANVAS'
    ? element as HTMLCanvasElement
    : null;
};

const redrawCanvas = (canvas: HTMLCanvasElement, drawings: Drawing[]): void => {
  const ctx = canvas.getContext('2d');
  clearCanvas(canvas, ctx);
  drawCanvas(ctx, drawings);
};

const makeCanvasDriver = () => (outgoing$: Stream<CanvasDescription>): Stream<any> => {
  const elts = {};
  let idGenerator = (() => {
    let i = 0;
    return () => ++i;
  })();

  const scheduleRedraws = (opId, canvasId, drawings, count = 0) => {
    setTimeout(
      () => {
        console.log('attempting a redraw for', canvasId);
        const lastOp = elts[canvasId] || 0;
        if (lastOp < opId) {
          const canvas = getCanvas(canvasId);
          if (canvas !== null) {
            redrawCanvas(canvas, drawings);
            elts[canvasId] = opId;
          } else if (count < 50) {
            scheduleRedraws(opId, canvasId, drawings, count + 1);
          } else {
            console.error(`Canvas element ${canvasId} not present`);
          }
        } // else, another drawing succeeded. Ignore...
      },
      50);
  }
  outgoing$.addListener({
    next: ({id: canvasId, drawings}) => {
      const opId = idGenerator();
      // console.log('Drawing', canvasId, 'with', drawings);
      const canvas = getCanvas(canvasId);
      if (canvas !== null) {
        redrawCanvas(canvas, drawings);
        elts[canvasId] = opId;
      } else {
        // Retry a bit later
        scheduleRedraws(opId, canvasId, drawings);
      }
    },
    error: (e) => {
      console.error('Error while rendering canvas', e);
    },
    complete: () => {},
  });

  const incoming$: Stream<any> = xs.create({
    start: listener => {
      console.log('No event are produced. Should not listen to IO');
      return null;
    },
    stop: () => {},
  });

  return adapt(incoming$);
};

export default makeCanvasDriver;
export {
  CanvasDescription,
  Drawing,
  Rect,
  Circle,
  isCircle,
  isRect
};

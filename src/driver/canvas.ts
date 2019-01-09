import xs, {Stream} from 'xstream';
import {adapt} from '@cycle/run/lib/adapt';
import { canvas } from '@cycle/dom';

type Rect = {

};
type Circle = {
  x: number,
  y: number,
  radius: number,
  color: string
};
type Drawing = Rect | Circle;

type CanvasDescription = {
  id: string,
  drawings: Drawing[]
};

function isCircle(d: Drawing): d is Circle {
  return (d as Circle).radius !== undefined;
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
    }
  });
};

const makeCanvasDriver = () => (outgoing$: Stream<CanvasDescription>): Stream<any> => {
  outgoing$.addListener({
    next: ({id: canvasId, drawings}) => {
      console.log('Drawing', canvasId, 'with', drawings);
      const element = document.getElementById(canvasId);
      if (element && element.nodeName === 'CANVAS') {
        const canvas = element as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        clearCanvas(canvas, ctx);
        drawCanvas(ctx, drawings);
      } else {
        // Retry a bit later
        // FIXME: do something smarter
        setTimeout(
          () => {
            console.log('attempting a redraw for', canvasId);
            const element = document.getElementById(canvasId);
            if (element && element.nodeName === 'CANVAS') {
              const canvas = element as HTMLCanvasElement;
              const ctx = canvas.getContext('2d');
              drawCanvas(ctx, drawings);
            } else {
              console.error(`Canvas element ${canvasId} not present`);
            }
          },
          250);
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
  Circle
};

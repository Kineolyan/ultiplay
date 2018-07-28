import xs from 'xstream';
import {h, div} from '@cycle/dom';
import {makeCollection} from 'cycle-onionify';
import isolate from '@cycle/isolate';

function getMousePosition(svg, evt) {
  var CTM = svg.getScreenCTM();
  return {
    x: (evt.clientX - CTM.e) / CTM.a,
    y: (evt.clientY - CTM.f) / CTM.d
  };
}

const createCombobject = (acc, v) => {
  if (v === 1 || v === -1) {
    return Object.assign({}, acc, {trigger: v});
  } else {
    return Object.assign({}, acc, {payload: v});
  }
};

const updatePlayerState = (state, value) => {
  const {points} = state;
  const idx = points.findIndex(v => v.id === value.id);
  const copy = [...points];
  copy[idx] = value;
  return Object.assign({}, state, {points: copy});
};

const makePoint = point => h(
  'circle.draggable.player',
  {attrs: {
    cx: 150 + point.x,
    cy: 150 + point.y,
    r: 15,
    stroke: 'black',
    strokeWidth: 1,
    fill: 'blue',
    draggable: 'true',
    cid: point.id
  }});

const Point = (sources) => {
  const state$ = sources.onion.state$;
  const clicks$ = sources.DOM.select('.player').events('click');
  const selectedId$ = xs.combine(state$, clicks$)
    .map(([{id}]) => id);

  const vdom$ = state$.map(makePoint);

  return {
    DOM: vdom$,
    selected: selectedId$
  };
};

const Points = (sources) => {
  const PointCollection = makeCollection({
    item: Point,
    itemKey: (pointState, index) => pointState.id,
    itemScope: key => key,
    collectSinks: instances => ({
      DOM: instances.pickCombine('DOM'),
      selected: instances.pickMerge('selected')
    })
  });
  return PointCollection(sources);
};

const Colors = (sources) => {
  const state$ = sources.onion.state$;
  const selectedColor$ = sources.DOM.events('click')
    .filter(e => e.srcElement.className === 'color-block')
    .map(e => {
      e.stopPropagation();
      return parseInt(e.srcElement.dataset['colorIndex']);
    });

  const vdom$ = state$.map(({colors, selected}) => {
    if (selected) {
      return div([
          'Player color:',
          ...colors.map((color, idx) => div(
            '.color-block',
            {attrs:
              {
                'data-color-index': idx,
                style: `background-color: #${color};`
              }
            }))
      ]);
    } else {
      return undefined;
    }
  });

  return {
    DOM: vdom$,
    color$: selectedColor$
  };
};

const Field = (sources) => {
  const svg$ = sources.DOM.select('svg');
  const startDrag$ = svg$.events('mousedown')
    .filter(e => e.target.classList.contains('draggable'))
    .map(e => {
      const svg = e.ownerTarget;
      const elt = e.target;
      const offset = getMousePosition(svg, e);
      offset.x -= parseFloat(elt.getAttributeNS(null, 'cx'));
      offset.y -= parseFloat(elt.getAttributeNS(null, 'cy'));

      return {element: elt, offset};
    });
  const endDrag$ = svg$.events('mouseup');
  const onDrag$ = svg$.events('mousemove');
  const svgPosition$ = onDrag$.map(e => {
    e.preventDefault();
    const svg = e.ownerTarget;
    return getMousePosition(svg, e);
  });

  const position$ = startDrag$
    .map(({element, offset}) => {
      const id = element.getAttributeNS(null, 'cid');
      return svgPosition$
        .map(position => ({
          id,
          x: position.x - offset.x,
          y: position.y - offset.y
        }))
    })
    .flatten();
  const dragTrigger$ = xs.merge(
      startDrag$.mapTo(1),
      onDrag$.mapTo(0),
      endDrag$.mapTo(-1))
    .fold(
      (acc, v) => {
        if (acc < 0 && v > 0) {
          return 1; // New drag start, move the element
        } else if (acc > 0 && v < 0) {
          return -1; // Drag end, stop moving
        } else {
          return acc; // Don't change anything
        }
      },
      -1);

  const stateUpdate$ = xs.merge(
      xs.combine(startDrag$, position$),
      dragTrigger$)
    .fold(
      (before, v) => {
        const next = createCombobject(before, v);
        if (next.trigger && next.payload) {
          if (next.trigger > 0) {
            const [{element}, {x, y}] = next.payload;
            element.setAttributeNS(null, 'cx', x);
            element.setAttributeNS(null, 'cy', y);

            next.state = false;

            return next;
          } else if (before.trigger > 0) { // && next.trigger < 0
            next.state = true;
            return next;
          } else  {
            next.state = false;
            return next;
          }
        } else {
          return next;
        }
      },
      {trigger: -1})
    .filter(p => p.state)
    .map(combo => combo.payload[1])
    .map((position) => {
      position.x -= 150;
      position.y -= 150;
      return position;
    });
  const positionReducer$ = stateUpdate$.map(update => state => updatePlayerState(state, update));

  const points = isolate(Points, 'points')(sources);
  const selectedReducer$ = points.selected
    .debug('id')
    .map(id => state => Object.assign({}, state, {selected: id}));

  const colorLens = {
    get: ({colors, selected}) => ({colors, selected}),
    set: (state) => state // No change
  };
  const colors = isolate(Colors, {onion: colorLens})(sources);
  const colorReducer$ = colors.color$.map(idx => state => {
    if (state.selected) {
      const points = state.points.slice();
      const selectedPoint = points.find(p => p.id === state.selected);
      selectedPoint.color = idx;
      return Object.assign({}, state, {points});
    } else {
      return state;
    }
  })

  const reducer$ = xs.merge(positionReducer$, selectedReducer$, colorReducer$);

  const vdom$ = xs.combine(points.DOM, colors.DOM)
    .map(([elements, colors]) =>
      div(
        '#field',
        [
          div('2D Field'),
          colors,
          h(
            'svg',
            {attrs: {width: 300, height: 300}},
            elements)
        ]))
    .remember();

	return {
    DOM: vdom$,
    onion: reducer$
	};
}

export {
  Field
}

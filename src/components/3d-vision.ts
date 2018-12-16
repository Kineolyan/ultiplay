import {h, div} from '@cycle/dom';

// In meters
const FIELD_WIDTH: number = 38;
const FIELD_HEIGHT: number = 100;
const ZONE_HEIGHT: number = 18;
const DISPLAY_SCALE: number = 2;

type Position = {
  x: number,
  y: number
}
// From decimeter position to meter in the view
const toView: (Position) => Position = ({x, y}) => ({
	x: (x / (10 * DISPLAY_SCALE)),
	y: (y / (10 * DISPLAY_SCALE))
});

const verticalLine = (x) => h(
  'a-box',
  {
    attrs: {
      position: `${x} 0 0`,
      color: 'white',
      depth: FIELD_HEIGHT / 2,
      height: 0.5,
      width: 0.1
    }
  });

const horizontalLine = (y) => h(
  'a-box',
  {
    attrs: {
      position: `0 0 ${y}`,
      color: 'white',
      depth: 0.1,
      height: 0.5,
      width: FIELD_WIDTH / 2
    }
  });

const drawField = () => [
  // Lateral bands
  verticalLine(-FIELD_WIDTH / (2 * DISPLAY_SCALE)),
  verticalLine(FIELD_WIDTH / (2 * DISPLAY_SCALE)),
  // front/back bands
  horizontalLine(-FIELD_HEIGHT / (2 * DISPLAY_SCALE)),
  horizontalLine(-(FIELD_HEIGHT / 2 - ZONE_HEIGHT) / DISPLAY_SCALE),
  horizontalLine((FIELD_HEIGHT / 2 - ZONE_HEIGHT) / DISPLAY_SCALE),
  horizontalLine(FIELD_HEIGHT / (2 * DISPLAY_SCALE))
];

const cylinder = ({x, y, color}, colors) => {
  const {x: px, y: py} = toView({x, y});
  return h(
    'a-cylinder',
    {
      attrs: {
        position: `${(-px).toFixed(2)} 0.9 ${(-py).toFixed(2)}`,
        radius: '0.4',
        height: '1.8',
        color: colors[color]
      }
    });
};

const renderScene = ({players, height, colors}) => {
  return h(
    'a-scene',
    {
      attrs: {
        environment: 'preset: forest',
        embedded: ''
      }
    },
    [
      ...drawField(),
      ...players.map(p => cylinder(p, colors)),
      h(
        'a-entity',
        {
          attrs: {
            position: `0 ${height} 0`,
            rotation: '0 180 0'
          }
        },
        [
          h('a-camera', [
            h('a-cursor', {attrs: {color: '#FAFAFA'}})
          ])
        ])
    ]);
};

const Scene = (sources) => {
  const state$ = sources.onion.state$;
  const vdom$ = state$
    .map(state =>
      div(
        {attrs:
          {class: 'view-3d'}
        },
        [
          renderScene(state)
        ]))
    .replaceError(() => div('Internal error in 3D vision'));

  return {
    DOM: vdom$
  };
}

export {
  Scene
};

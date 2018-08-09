import xs from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, div, span, button, makeDOMDriver, i, table} from '@cycle/dom';
import onionify from 'cycle-onionify';
import isolate from '@cycle/isolate';
import 'aframe';
import 'aframe-environment-component';

import {IncDecButtons} from './components/buttons';
import {Scene} from './components/3d-vision';
import {Field} from './components/field';
import Codec from './components/codec';
import {createPlayer} from './components/players';

enum Tab {
  FIELD,
  VISION,
  COMBO,
  CODEC
};

function getTabName(tab: Tab): string {
  switch (tab) {
  case Tab.FIELD: return 'Field';
  case Tab.VISION: return '3D vision';
  case Tab.COMBO: return 'Combo view';
  case Tab.CODEC: return 'Import/Export';
  default: throw new Error(`Unsported enum value ${tab}`);
  }
}

const main = (sources) => {
  const initialReducer$ = xs.of(() => ({
    height: 2,
    tab: Tab.COMBO,
    colors: [
      '#1f77b4',
      '#ff7f0e',
      '#2ca02c',
      '#d62728',
      '#9467bd',
      '#ffd400',
      '#17becf'
    ],
    points: [
      createPlayer({id: 1, x: 0, y: 0}),
      createPlayer({id: 2, x: 0, y: 50})
    ],
    mode: null
  }));

  const HeightInc = isolate(IncDecButtons, 'height');
  const heightProps$ = xs.of({
      text: 'Height',
      increment: 0.25
    }).remember();
  const heightInc = HeightInc(
    Object.assign({}, sources, {props$: heightProps$}));

  const fieldLens = {
    get: ({points, colors, selected}) => ({points, colors, selected}),
    set: (state, {points, selected}) => Object.assign({}, state, {points, selected})
  };
  const field = isolate(Field, {onion: fieldLens})(sources);

  const codecLens = {
    get: ({height, points, mode, selected}) => ({
      payload: {height, points, selected},
      mode
    }),
    set: (state, {mode, payload}) => {
      const newState = Object.assign({}, state);
      if (payload !== undefined) {
        Object.assign(newState, payload);
      }
      if (mode !== undefined) {
        newState.mode = mode;
      }
      return newState;
    }
  };
  const codec = isolate(Codec, {onion: codecLens})(sources);

  const sceneLens = {
    get: ({height, points, colors}) => ({height, players: points, colors}),
    set: (state) => state
  };
  const scene = isolate(Scene, {onion: sceneLens})(sources);

  const tabClick$ = sources.DOM.select('.tab').events('click')
    .map(e => parseInt(e.srcElement.dataset['id']) as Tab);
  const tabReducer$ = tabClick$.map(tab => state => ({...state, tab}));
  
  const reducer$ = xs.merge(
    initialReducer$,
    heightInc.onion,
    field.onion,
    codec.onion,
    tabReducer$);

  const state$ = sources.onion.state$;
  const vdom$ = xs.combine(
      state$,
      scene.DOM,
      heightInc.DOM,
      field.DOM,
      codec.DOM)
    .map(([{tab}, scene, heightInc, field, codec]) => {
      const tabElements = [];
      switch (tab) {
        case Tab.FIELD:
          tabElements.push(field);
          break;
        case Tab.VISION:
          tabElements.push(heightInc, scene);
          break;
        case Tab.COMBO:
          tabElements.push(field, heightInc, scene);
          break;
        case Tab.CODEC:
          tabElements.push(codec);
          break;
        default:
          tabElements.push(div(`Unknown tab ${tab}`));
      }

      const tabs = [
        Tab.FIELD,
        Tab.VISION,
        Tab.COMBO,
        Tab.CODEC
      ].map(t => {
        const attrs = {
          'data-id': t,
          class: 'tab'
        };
        const name = getTabName(t);
        return tab === t
          ? h('li', {attrs}, [h('b', name)])
          : h('li', {attrs}, name);
      });

      return div(
      [
        div('Small browser application to display Ultimate tactics in 3D'),
        h('ul', tabs),
        ...tabElements
      ]);
    })
    .replaceError(() => xs.of(div('Internal error')));

  return {
    DOM: vdom$,
    onion: reducer$,
  };
};

Cycle.run(
  onionify(main),
  {DOM: makeDOMDriver('#app')});

// var a = xs.periodic(1000)
//   .filter(i => i % 2 === 0)
//   .map(i => i * i)
//   .debug('a')
//   .take(10);
// var b = xs.periodic(750)
//     .fold((acc, c) => acc + c, 0)
//     .debug('b')
//     .take(15);
// const c = xs.merge(a, b);

// c.addListener({
//   next: i => console.log(i),
//   error: err => console.error(err),
//   complete: () => console.log('completed'),
// })

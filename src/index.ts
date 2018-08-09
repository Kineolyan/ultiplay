import xs from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, div, span, button, makeDOMDriver, i} from '@cycle/dom';
import onionify from 'cycle-onionify';
import isolate from '@cycle/isolate';
require('aframe');
require("aframe-environment-component");

import {IncDecButtons} from './components/buttons';
import {Scene} from './components/3d-vision';
import {Field} from './components/field';
import Codec from './components/codec';
import {createPlayer} from './components/players';

const main = (sources) => {
  const initialReducer$ = xs.of(() => ({
    nbPlayers: 2,
    height: 2,
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
      createPlayer({id: "p-a1", x: 0, y: 0}),
      createPlayer({id: "p-a2", x: 0, y: 50})
    ]
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
    get: ({nbPlayers, height, points, mode, selected}) => ({
      payload: {nbPlayers, height, points, selected},
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
  
  const reducer$ = xs.merge(
    initialReducer$,
    heightInc.onion,
    field.onion,
    codec.onion);

  const state$ = sources.onion.state$;
  const vdom$ = xs.combine(
      scene.DOM,
      heightInc.DOM,
      field.DOM,
      codec.DOM)
    .map(([scene, heightInc, field, codec]) => div(
      [
        div('Small browser application to display Ultimate tactics in 3D'),
        heightInc,
        field,
        scene,
        codec
      ]))
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

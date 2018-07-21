import xs from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, div, span, button, makeDOMDriver, i} from '@cycle/dom';
import onionify from 'cycle-onionify';
import isolate from '@cycle/isolate';
require('aframe');
require("aframe-environment-component");

import {IncDecButtons} from './components/buttons.js';
import {Scene} from './components/3d-vision.js';
import {Field} from './components/field.js';
import Codec from './components/codec.js';

const main = (sources) => {
  const PlayerInc = isolate(IncDecButtons, 'nbPlayers');
	const playerIncProps$ = xs.of({text: 'Players'}).remember();
	const playerInc = PlayerInc(
    Object.assign({}, sources, {props$: playerIncProps$}));
  const HeightInc = isolate(IncDecButtons, 'height');
  const heightProps$ = xs.of({text: 'Height'}).remember();
  const heightInc = HeightInc(
    Object.assign({}, sources, {props$: heightProps$}));
  const field = isolate(Field, 'points')(sources);
  const codecLens = {
    get: ({nbPlayers, height, points, mode}) => ({
      payload: {nbPlayers, height, points},
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
    get: ({height, points}) => ({height, players: points}),
    set: (state) => state
  };
  const scene = isolate(Scene, {onion: sceneLens})(sources);

  const initialReducer$ = xs.of(() => ({
    nbPlayers: 2,
    height: 0,
    points: [
      {id: "p-a1", x: 150, y: 150},
      {id: "p-a2", x: 150, y: 200}
    ]
  }));

  const addRemovePlayers$ = playerInc.increment
    .map(value => state => {
      const copy = [...state.points];
      if (value > 0) {
        // Add a new player
        copy.push({
          id: `p-a${copy.length + 1}`,
          x: 0,
          y: 0
        });
      } else {
        // Remove the last player
        copy.pop();
      }
      return Object.assign({}, state, {points: copy});
    });
  const reducer$ = xs.merge(
    initialReducer$,
    playerInc.onion,
    heightInc.onion,
    field.onion,
    addRemovePlayers$,
    codec.onion);

  const state$ = sources.onion.state$;
  const vdom$ = xs.combine(
      scene.DOM,
      playerInc.DOM,
      heightInc.DOM,
      field.DOM,
      codec.DOM)
    .map(([scene, playerInc, heightInc, field, codec]) => div(
      [
        div('Small browser application to display Ultimate tactics in 3D'),
        playerInc,
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
}

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

import xs from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, div, span, button, makeDOMDriver} from '@cycle/dom';
import onionify from 'cycle-onionify';
import isolate from '@cycle/isolate';
require('aframe');
require("aframe-environment-component");

import {Button, IncDecButtons} from './components/buttons.js';

const cyclinders = (count) => {
  let res = [];
  for (let i = 0; i < count; i += 1) {
    res.push(h(
      'a-cylinder', 
      {
        attrs: {
          position: `0 1 ${-3 - i * 1.5}`,
          radius: '0.4',
          height: '1.8',
          color: '#FFC65D'
        }
      }));
  }
  return res;
};

const renderScene = (state) => h(
  'a-scene', 
  {
    attrs: {
      environment: 'preset: forest',
      embedded: ''
    }
  }, 
  [
    ...cyclinders(state.nbPlayers),
    h(
      'a-entity',
      {
        attrs: {
          position: `1 ${state.height} 0`,
          rotation: '0 15 0'
        }
      },
      [
        h('a-camera', [
          h('a-cursor', {attrs: {color: '#FAFAFA'}})
        ])
      ])
  ]);

const main = (sources) => {
  const PlayerInc = isolate(IncDecButtons, 'nbPlayers');
	const playerIncProps$ = xs.of({text: 'Players'}).remember();
	const playerInc = PlayerInc(
    Object.assign({}, sources, {props$: playerIncProps$}));
  const HeightInc = isolate(IncDecButtons, 'height');
  const heightProps$ = xs.of({text: 'Height'}).remember();
  const heightInc = HeightInc(
    Object.assign({}, sources, {props$: heightProps$}));

  const initialReducer$ = xs.of(() => ({nbPlayers: 1, height: 0}));
  const reducer$ = xs.merge(
    initialReducer$,
    playerInc.onion,
    heightInc.onion);

  const state$ = sources.onion.state$;
  const vdom$ = xs.combine(state$, playerInc.DOM, heightInc.DOM)
    .map(([state, playerInc, heightInc]) => div(
      [
        div('Small browser application to display Ultimate tactics in 3D'),
        playerInc,
        heightInc,
        div(
          {attrs: {id: 'view-3d'}},
          [renderScene(state)])
      ]));

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
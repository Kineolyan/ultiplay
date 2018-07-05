import xs from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, div, button, makeDOMDriver} from '@cycle/dom';
import onionify from 'cycle-onionify';
import isolate from '@cycle/isolate';
require('aframe');
require("aframe-environment-component");

const Button = (sources) => {
	let props$ = sources.props$;
	const click$ = sources.DOM.select('.button').events('click');
  const delta$ = props$
    .map((props) => click$.map(() => props.amount))
    .flatten();
	const vdom$ = props$.map(props => button('.button', [props.text]));

	return {
		DOM: vdom$,
		delta$: delta$
	}
}


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

const renderScene = () => h(
  'a-scene', 
  {
    attrs: {
      environment: 'preset: forest',
      embedded: ''
    }
  }, 
  [
    ...cyclinders(3),
    h(
      'a-entity',
      {
        attrs: {
          position: '1 0 0',
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
  const state$ = sources.onion.state$;

	const IncrementButton = isolate(Button);
	const DecrementButton = isolate(Button);

	const incrementButtonProps$ = xs.of({text: 'Increment', amount: 1}).remember();
	const decrementButtonProps$ = xs.of({text: 'Decrement', amount: -1}).remember();

	const incrementButton = IncrementButton({DOM: sources.DOM, props$: incrementButtonProps$});
	const decrementButton = DecrementButton({DOM: sources.DOM, props$: decrementButtonProps$});

  const initialReducer$ = xs.of(() => ({value: 0}));
	const count$ = xs.merge(incrementButton.delta$, decrementButton.delta$)
    .map(value => (prev) => ({value: value + prev.value}));
  const reducer$ = xs.merge(initialReducer$, count$);

  const resultDom$ = state$.map(state => div(`Current count: ${state.value}`));
  const vdom$ = xs.combine(resultDom$, incrementButton.DOM, decrementButton.DOM)
    .map(([count, incrementVTree, decrementVTree]) => div(
      [
        div('Small browser application to display Ultimate tactics in 3D'),
        count,
        div([
          incrementVTree,
          decrementVTree
        ]),
        div(
          {attrs: {id: 'view-3d'}},
          [renderScene()])
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
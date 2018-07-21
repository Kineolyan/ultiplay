import xs from 'xstream';
import {h, div, span, button} from '@cycle/dom';
import isolate from '@cycle/isolate';

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
	};
}

const IncDecButtons = (sources) => {
	const IncrementButton = isolate(Button);
	const DecrementButton = isolate(Button);

	const incrementButtonProps$ = xs.of({text: 'Increment', amount: 1}).remember();
	const decrementButtonProps$ = xs.of({text: 'Decrement', amount: -1}).remember();

	const incrementButton = IncrementButton({DOM: sources.DOM, props$: incrementButtonProps$});
	const decrementButton = DecrementButton({DOM: sources.DOM, props$: decrementButtonProps$});

  let props$ = sources.props$;
  let state$ = sources.onion.state$;
  const picks$ = xs.merge(incrementButton.delta$, decrementButton.delta$);
  const reducer$ = picks$.map(value => prev => Math.max(1, value + prev));
  const vdom$ = xs.combine(props$, incrementButton.DOM, decrementButton.DOM)
    .map(([props, incrementVTree, decrementVTree]) =>  div([
      span(props.text || "+/-"),
      incrementVTree,
      decrementVTree
    ]));
	return {
    DOM: vdom$,
    onion: reducer$,
    increment: picks$
	};
};

export {
  Button,
  IncDecButtons
}

import xs, { Stream } from 'xstream';
import {h, div, span, button, DOMSource, VNode} from '@cycle/dom';
import isolate from '../ext/re-isolate';
import { Reducer, StateSource } from 'cycle-onionify';

type ButtonSources = {
  DOM: DOMSource,
  props$: Stream<{
    text: string
  }>
};
type ButtonSinks = {
  DOM: Stream<VNode>,
  click$: Stream<any>
};

function Button(sources: ButtonSources): ButtonSinks {
  let props$ = sources.props$;
	const click$ = sources.DOM.select('.button').events('click');
	const vdom$ = props$.map(props => button('.button', [props.text]));

	return {
		DOM: vdom$,
		click$
	};
}

type IncDecState = number;
type IncDecSources = {
  DOM: DOMSource,
  onion: StateSource<IncDecState>,
  props$: Stream<{
    min: number,
    text: string,
    incLabel?: string,
    decLabel?: string,
    increment?: number,
    format?: (n: number) => string
  }>
};
type IncDecSinks = {
  DOM: Stream<VNode>,
  onion: Stream<Reducer<IncDecState>>
};

function IncDecButtons(sources: IncDecSources): IncDecSinks {
	const IncrementButton = isolate(Button);
	const DecrementButton = isolate(Button);

  const props$ = sources.props$;
  const incrementButtonProps$ = props$
    .map(({incLabel}) => ({text: incLabel || '+'}));
	const incrementButton = IncrementButton({DOM: sources.DOM, props$: incrementButtonProps$});
	const decrementButtonProps$ = props$
    .map(({decLabel}) => ({text: decLabel || '-'}));
  const decrementButton = DecrementButton({DOM: sources.DOM, props$: decrementButtonProps$});
  
  const delta$: Stream<number> = props$
    .map(({increment}) => {
      const value = increment || 1;
      return xs.merge(
        incrementButton.click$.mapTo(value),
        decrementButton.click$.mapTo(-value));
    })
    .flatten();

  let state$ = sources.onion.state$;
  const reducer$ = xs.combine(delta$, props$)
    .map(([value, {min}]) => (prev: number) => Math.max((min || 0), value + prev));
  const vdom$ = xs.combine(state$, props$, incrementButton.DOM, decrementButton.DOM)
    .map(([state, {text, format}, incrementVTree, decrementVTree]) =>  div([
      span(text || "+/-"),
      span(`: ${format ? format(state) : state}`),
      incrementVTree,
      decrementVTree
    ]));

	return {
    DOM: vdom$,
    onion: reducer$
	};
};

export {
  Button,
  IncDecButtons
}

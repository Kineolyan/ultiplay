import { DOMSource, VNode, div, span, button } from "@cycle/dom";
import xs, { Stream } from "xstream";
import debounce from 'xstream/extra/debounce';
import { printStream, composablePrint } from "../operators/out";

type State = {
  current: number,
  pages: number 
};

type Sources = {
  DOM: DOMSource,
  onion: {
    state$: Stream<State>
  }
};
type Sinks = {
  DOM: Stream<VNode>,
  onion: Stream<(State) => State>
};

function Pagination(sources: Sources): Sinks {
  const {state$} = sources.onion;

  const next$ = sources.DOM.select('.next').events('click');
  const prev$ = sources.DOM.select('.prev').events('click');

  const nextReducer$ = next$.map(() => ({current, pages}) =>
    current < pages ? ({pages, current: current + 1}) : {current, pages});
  const prevReducer$ = prev$.map(() => ({current, pages}) =>
    current > 1 ? {pages, current: current - 1} : {current, pages});
  const reducer$ = xs.merge(nextReducer$, prevReducer$);

  const innerState$ = xs.merge(
    state$, 
    state$.map(
        state => reducer$.map(reducer => reducer(state)))
      .flatten());

  const vdom$ = innerState$.map(({current, pages}) => {
    const elements = [];
    const nextAttrs = current > 1
      ? {attrs: {disabled: ''}}
      : {};
    const prevAttrs = current < pages
      ? {attrs: {disabled: ''}}
      : {};
    return div(
      '.pagination', 
      [
        button('.prev', prevAttrs, 'Previous'),
        span(` ${current} `),
        button('.next', nextAttrs, 'Next')
      ]);
  });

  return {
    DOM: vdom$,
    onion: reducer$.compose(debounce(250))
  };
}

export default Pagination;
export {
  State
};

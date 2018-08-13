import { DOMSource, VNode, div, span, button } from "@cycle/dom";
import xs, { Stream } from "xstream";
import debounce from 'xstream/extra/debounce';
import { printStream, composablePrint } from "../operators/out";

type State<T> = {
  current: number,
  pages: T[] 
};

type Sources<T> = {
  DOM: DOMSource,
  onion: {
    state$: Stream<State<T>>
  }
};
type Sinks<T> = {
  DOM: Stream<VNode>,
  onion: Stream<(s: State<T>) => State<T>>
};

function moveItem<T>(elements: T[], from: number, to: number): T[] {
  if (from < to) {
    const copy = elements.slice();
    copy.splice(to - 1, 0, elements[from - 1]);
    copy.splice(from - 1, 1);
    return copy;
  } else if (to < from) {
    const copy = elements.slice();
    copy.splice(from - 1, 1);
    copy.splice(to - 1, 0, elements[from - 1]);
    return copy;
  } else {
    return elements;
  }
}

const moveBefore = (elements, current) => moveItem(elements, current, current - 1);
const moveAfter = (elements, current) => moveItem(elements, current, current + 1);

function Pagination<T>(sources: Sources<T>): Sinks<T> {
  const {state$} = sources.onion;

  const next$ = sources.DOM.select('.next').events('click');
  const prev$ = sources.DOM.select('.prev').events('click');
  const movePrev$ = sources.DOM.select('.move-prev').events('click');
  const moveNext$ = sources.DOM.select('.move-next').events('click');

  // TODO find a smart way to debounce the clicks
  // The reducer still shoud apply to the state, not to suffer from concurrency
  const prevReducer$ = prev$.map(() => ({current, pages}) =>
    current > 1 ? {pages, current: current - 1} : {current, pages});
  const nextReducer$ = next$.map(() => ({current, pages}) =>
    current < pages.length ? {pages, current: current + 1} : {current, pages});
  const movePrevCursor$ = movePrev$.map(() => ({current, pages}) =>
    current > 1 
      ? {current: current - 1, pages: moveBefore(pages, current)} 
      : {current, pages});
  const moveNextCursor$ = moveNext$.map(() => ({current, pages}) =>
    current < pages.length
      ? {current: current + 1, pages: moveAfter(pages, current)} 
      : {current, pages});

  const reducer$ = xs.merge(
    nextReducer$, 
    prevReducer$,
    movePrevCursor$,
    moveNextCursor$);

  const innerState$ = xs.merge(
    state$, 
    state$
      .map(state => reducer$.map(reducer => reducer(state)))
      .flatten());

  const vdom$ = innerState$.map(({current, pages}) => {
    const elements = [];
    const nextAttrs = current > 1
      ? {attrs: {disabled: ''}}
      : {};
    const prevAttrs = current < pages.length
      ? {attrs: {disabled: ''}}
      : {};
    return div(
      '.pagination', 
      [
        button('.move-prev', prevAttrs, 'Move Previous'),
        button('.prev', prevAttrs, 'Previous'),
        span(` ${current} / ${pages.length}`),
        button('.next', nextAttrs, 'Next'),
        button('.move-next', nextAttrs, 'Move Next')
      ]);
  });

  return {
    DOM: vdom$,
    onion: reducer$
  };
}

export default Pagination;
export {
  State
};

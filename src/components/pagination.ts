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

const disabledAttrs = (disable: boolean) => 
  disable
    ? {attrs: {disabled: ''}}
    : {};

function Pagination<T>(sources: Sources<T>): Sinks<T> {
  const {state$} = sources.onion;

  const clicks$ = (selector: string) => sources.DOM.select(selector).events('click');
  const next$ = clicks$('.next');
  const prev$ = clicks$('.prev');
  const movePrev$ = clicks$('.move-prev');
  const moveNext$ = clicks$('.move-next');
  const delete$ = clicks$('.delete');

  // TODO find a smart way to debounce the clicks
  // The reducer still shoud apply to the state, not to suffer from concurrency
  const prevReducer$ = prev$.map(() => ({current, pages}) =>
    current > 1 ? {pages, current: current - 1} : {current, pages});
  const nextReducer$ = next$.map(() => ({current, pages}) =>
    current < pages.length ? {pages, current: current + 1} : {current, pages});
  const movePrevReducer$ = movePrev$.map(() => ({current, pages}) =>
    current > 1 
      ? {current: current - 1, pages: moveBefore(pages, current)} 
      : {current, pages});
  const moveNextReducer$ = moveNext$.map(() => ({current, pages}) =>
    current < pages.length
      ? {current: current + 1, pages: moveAfter(pages, current)} 
      : {current, pages});

  const deleteReducer$ = delete$.map(() => ({current, pages}: State<T>) => {
    if (current < pages.length) {
      const copy = pages.slice();
      copy.splice(current, 1);
      return {current, pages: copy};
    } else if (pages.length > 1) {
      // Last page of many
      const copy = pages.slice(0, current - 1);
      return {current: current -1, pages: copy};
    } else {
      // Last only page
      throw new Error('Cannot remove the last element');
    }
  });

  const reducer$ = xs.merge(
    nextReducer$, 
    prevReducer$,
    movePrevReducer$,
    moveNextReducer$,
    deleteReducer$);

  const vdom$ = state$.map(({current, pages}) => {
    const elements = [];
    const prevAttrs = disabledAttrs(current === 1);
    const nextAttrs = disabledAttrs(current === pages.length);
    return div(
      '.pagination', 
      [
        button('.move-prev', prevAttrs, 'Move Previous'),
        button('.prev', prevAttrs, 'Previous'),
        span(pages.length > 0 ? ` ${current} / ${pages.length} ` : ' <none> '),
        button('.delete', disabledAttrs(pages.length === 1), 'Delete'),
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

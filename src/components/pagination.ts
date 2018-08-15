import { DOMSource, VNode, div, span, button } from "@cycle/dom";
import xs, { Stream } from "xstream";
import debounce from 'xstream/extra/debounce';
import { printStream, composablePrint } from "../operators/out";

type State = {
  current: number,
  pages: number 
};

type MoveRequest = {
  from: number, 
  to: number
};
type CopyRequest = {
  item: number, 
  to: number
};

type Sources = {
  DOM: DOMSource,
  onion: {
    state$: Stream<State>
  }
};
type Sinks = {
  DOM: Stream<VNode>,
  onion: Stream<(s: State) => State>,
  moveItem: Stream<MoveRequest>,
  copyItem: Stream<CopyRequest>,
  deleteItem: Stream<number>
};

const disabledAttrs = (disable: boolean) => 
  disable
    ? {attrs: {disabled: ''}}
    : {};

function Pagination(sources: Sources): Sinks {
  const {onion: {state$}} = sources;

  const clicks$ = (selector: string) => sources.DOM.select(selector).events('click');
  const next$ = clicks$('.next');
  const prev$ = clicks$('.prev');
  const movePrev$ = clicks$('.move-prev');
  const moveNext$ = clicks$('.move-next');
  const delete$ = clicks$('.delete');
  const copyAfter$ = clicks$('.copy-after');

  // TODO find a smart way to debounce the clicks
  // The reducer still shoud apply to the state, not to suffer from concurrency
  const prevReducer$ = prev$.map(() => ({current, pages}) =>
    current > 1 ? {pages, current: current - 1} : {current, pages});
  const nextReducer$ = next$.map(() => ({current, pages}) =>
    current < pages ? {pages, current: current + 1} : {current, pages});

  const movePrevOrder$ = state$
    .filter(({current}) => current > 1)
    .map(({current}) => movePrev$.map(() => ({from: current, to: current - 1})))
    .flatten();
  const moveNextOrder$ = state$
    .filter(({current, pages}) => current < pages)
    .map(({current}) => moveNext$.map(() => ({from: current, to: current + 1})))
    .flatten();
  const moveOrder$ = xs.merge(movePrevOrder$, moveNextOrder$);

  const deleteOrder$ = state$
    .filter(({pages}) => pages > 1)
    .map(({current}) => delete$.map(() => current))
    .flatten();

  const copyAfterOrder$ = state$
    .filter(({pages}) => pages > 0)
    .map(({current}) => copyAfter$.map(() => ({item: current, to: current + 1})))
    .flatten();

  const reducer$ = xs.merge(
    nextReducer$, 
    prevReducer$);

  const vdom$ = state$.map(({current, pages}) => {
    const elements = [];
    const prevAttrs = disabledAttrs(current === 1);
    const nextAttrs = disabledAttrs(current === pages);
    return div(
      '.pagination', 
      [
        div([
          button('.move-prev', prevAttrs, 'Move Previous'),
          button('.prev', prevAttrs, 'Previous'),
          span(pages > 0 ? ` ${current} / ${pages} ` : ' <none> '),
          button('.next', nextAttrs, 'Next'),
          button('.move-next', nextAttrs, 'Move Next')
        ]),
        div([
          span('Item operations: '),
          button('.copy-after', 'Duplicate'),
          button('.delete', disabledAttrs(pages === 1), 'Delete')
        ])
      ]);
  });

  return {
    DOM: vdom$,
    onion: reducer$,
    moveItem: moveOrder$,
    copyItem: copyAfterOrder$,
    deleteItem: deleteOrder$
  };
}

export default Pagination;
export {
  State,
  MoveRequest,
  CopyRequest
};

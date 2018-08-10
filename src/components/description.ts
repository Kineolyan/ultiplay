import xs, {Stream} from 'xstream';
import { VNode, DOMSource, div } from "@cycle/dom";
import isolate from '@cycle/isolate';
import Editor from '../elements/editor';

type Sources = {
  DOM: DOMSource,
  onion: {
    state$: Stream<{value: string, edit: boolean}>
  }
};
type Sinks = {
  DOM: Stream<VNode>,
  onion: Stream<any>
};

function Description(sources: Sources): Sinks {
  const state$ = sources.onion.state$;
  const dblClick$ = sources.DOM.select('.view').events('dblclick');
  const editor = isolate(Editor)({
    DOM: sources.DOM,
    props$: state$.map(({value}) => ({value, submitLabel: 'Save'}))
  });
  const valueReducer$ = editor.value$
    .map(value => state => ({...state, value}));
  const editReducer$ = xs.merge(
      dblClick$.mapTo(true),
      editor.value$.mapTo(false))
    .map(edit => state => ({...state, edit}));
  const reducer$ = xs.merge(valueReducer$, editReducer$);

  const vdom$ = xs.combine(state$, editor.DOM)
    .map(([{value, edit}, editor]) => {
      return edit
        ? editor
        : div('.view', value);
    });

  return {
    DOM: vdom$,
    onion: reducer$
  };
};

export default Description;

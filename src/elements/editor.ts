import xs, {Stream} from 'xstream';
import debounce from 'xstream/extra/debounce';
import {h, div, button, textarea, sub, DOMSource, VNode} from '@cycle/dom';

import {trigger} from '../operators/trigger';

type Props = {
  value: string,
  submitLabel?: string
};
type Sources = {
  DOM: DOMSource,
  props$: Stream<Props>
};
type Sinks = {
  DOM: Stream<VNode>,
  value$: Stream<string | undefined>
};
type InputEvent = {srcElement: {type: string, value: string}};

function Editor(sources: Sources): Sinks {
  const props$ = sources.props$;
  const submit$ = sources.DOM.select('.submit').events('click');
  const edit$ = (sources.DOM.events('input') as any) as Stream<InputEvent>;
  const value$ = props$.map(
    ({value}) => edit$ 
      .filter(e => e.srcElement.type === 'textarea')
      .compose(debounce(250))
      .map(e => e.srcElement.value)
      .startWith(value)
      .compose(trigger(submit$)))
    .flatten();

  const vdom$ = props$.map(({value, submitLabel}) =>
    div([
      div(textarea(value)),
      div(button('.submit', submitLabel || 'Submit'))
    ]));

	return {
    DOM: vdom$,
    value$
	};
};

export default Editor;

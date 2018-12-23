import { DOMSource, VNode, div, h } from "@cycle/dom";
import xs, { Stream } from "xstream";

type Sources = {
  DOM: DOMSource
};

type Sinks = {
  DOM: Stream<VNode>
};

function Help({DOM: dom$}: Sources): Sinks {
  const click$ = dom$.select('.toggle').events('click');
  const toggleReducer$ = click$.map(() => show => !show);

  const vdom$ = xs.of(div(
    h('p',
      h('i',
        'Double Click on the description to edit it'))));

  return {
    DOM: vdom$
  };
}

export default Help;
export {
  Sources,
  Sinks
};

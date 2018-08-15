import { DOMSource, VNode, h, div } from "@cycle/dom";
import xs, { Stream } from "xstream";

enum Tab {
  FIELD,
  VISION,
  COMBO,
  CODEC
};

function getTabName(tab: Tab): string {
  switch (tab) {
  case Tab.FIELD: return 'Field';
  case Tab.VISION: return '3D vision';
  case Tab.COMBO: return 'Combo view';
  case Tab.CODEC: return 'Import/Export';
  default: throw new Error(`Unsported enum value ${tab}`);
  }
}

type State<T> = {
  tabs: {tab: T, label: string}[],
  tab: T
};

type Sources<T> = {
  DOM: DOMSource,
  onion: {
    state$: Stream<State<T>>
  },
  children$: Stream<VNode[]>
};

type Sinks<T> = {
  DOM: Stream<VNode>,
  onion: Stream<(s: State<T>) => State<T>>
};

function Tabs<T>({DOM: dom$, children$, onion: {state$}}: Sources<T>): Sinks<T> {
  const tabClick$ = dom$.select('.tab').events('click');
  const selectedTab$ = tabClick$
    .map(e => parseInt(e.srcElement.dataset['id']) as Tab);
  const tabReducer$ = selectedTab$.map(tab => state => ({...state, tab}));

  const vdom$ = xs.combine(state$, children$)
    .map(([{tabs, tab}, children]) => {
      const tabDOM = tabs.map(({tab: t, label}) => {
        const attrs = {
          'data-id': t,
          class: 'tab',
          style: tab === t ? 'font-weight: bold' : ''
        };
        return h('li', {attrs}, label);
      });
      return div(
        '.tabs',
        [
          h('ul', tabDOM),
          ...children
        ]);
    });
  
  return {
    DOM: vdom$,
    onion: tabReducer$
  };
}

export {
  Tab,
  getTabName,
  State,
  Tabs
};

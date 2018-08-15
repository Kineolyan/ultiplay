import xs, {Stream} from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, div, span, button, makeDOMDriver, i, table, DOMSource, VNode} from '@cycle/dom';
import onionify from 'cycle-onionify';
import isolate from '@cycle/isolate';
import 'aframe';
import 'aframe-environment-component';

import {Tab, getTabName, Tabs, State as TabsState} from './components/tab';
import Codec from './components/codec';
import {Player, createPlayer, PlayerId} from './components/players';
import Scenario, {State as ScenarioState} from './components/scenario';
import Pagination, * as pag from './components/pagination';

type Tactic = {
  description: string,
  height: number,
  points: Player[]
};
type TacticDisplay = {
  tab: Tab,
  editDescription: boolean,
  selected?: PlayerId,
};
type State = {
  // Constants
  colors: string[],
  mode: string | null,
  tacticIdx: number,
  // Tactics
  tactics: Tactic[],
  display: TacticDisplay[]
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

const getTactic: (s: State) => Tactic = (state) => state.tactics[state.tacticIdx];
const updateTactics: (s: State, f: (Tactic) => Tactic) => State = (state, op) => {
  const tactics = state.tactics.slice();
  tactics[state.tacticIdx] = op(tactics[state.tacticIdx]);
  state.tactics = tactics;

  return state;
};
const cloneTactic = ({height, description, points}) => ({
  height,
  description,
  points: points.map(p => ({...p}))
});

const DEFAULT_DISPLAY: TacticDisplay = {
  tab: Tab.FIELD,
  editDescription: false
};
const getDisplay: (s: State) => TacticDisplay = (state) => state.display[state.tacticIdx];
const updateDisplay: (s: State, f: (TacticDisplay) => TacticDisplay) => State = (state, op) => {
  const copy = state.display.slice();
  copy[state.tacticIdx] = op(copy[state.tacticIdx]);
  state.display = copy;

  return state;
};

function moveItem<T>(elements: T[], from: number, to: number): T[] {
  if (from < to) {
    const copy = elements.slice();
    copy.splice(to, 0, elements[from - 1]);
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

function copyItem<T>(elements: T[], from: number, to: number, clone: (T) => T): T[] {
  const newItem = clone(elements[from - 1]);
  const copy = elements.slice();
  copy.splice(to - 1, 0, newItem);
  return copy;
}

function deleteItem<T>(elements: T[], item: number) {
  if (item < elements.length) {
    const copy = elements.slice();
    copy.splice(item - 1, 1);
    return copy;
  } else if (elements.length > 1) {
    // Last page of many
    const copy = elements.slice(0, item - 1);
    return copy;
  } else {
    // Last only page
    throw new Error('Cannot remove the last element');
  }
}

function main(sources: Sources): Sinks {
  const state$ = sources.onion.state$;
  const initialReducer$: Stream<(State) => State> = xs.of(() => ({
    mode: null,
    colors: [
      '#1f77b4',
      '#ff7f0e',
      '#2ca02c',
      '#d62728',
      '#9467bd',
      '#ffd400',
      '#17becf'
    ],
    tacticIdx: 1,
    tactics: [
      {
        description: 'tactic description here',
        points: [
          createPlayer({id: 1, x: 0, y: 0}),
          createPlayer({id: 2, x: 0, y: 50})
        ],
        height: 2
      },
      {
        description: 'Second tactics',
        points: [
          createPlayer({id: 1, x: 0, y: 0}),
          createPlayer({id: 2, x: 0, y: 50}),
          createPlayer({id: 3, x: 0, y: -50})
        ],
        height: 3.5
      }
    ],
    display: [
      DEFAULT_DISPLAY,
      DEFAULT_DISPLAY
    ]
  }));

  const codecLens = {
    get: ({tactics, selected, mode}) => ({
      payload: {selected, tactics},
      mode
    }),
    set: (state, {mode, payload}) => {
      const newState = {...state};
      if (payload !== undefined) {
        Object.assign(newState, payload);
      }
      if (mode !== undefined) {
        newState.mode = mode;
      }
      return newState;
    }
  };
  const codec = isolate(Codec, {onion: codecLens})(sources);

  const scenarioLens = {
    get(state: State): ScenarioState {
      const {colors} = state;
      const {points, height, description} = getTactic(state);
      const {tab, editDescription, selected} = getDisplay(state);
      return {colors, tab, selected, editDescription, points, height, description};
    },
    set(state: State, childState: ScenarioState): State {
      const {points, height, description, editDescription, selected} = childState;
      const newState = {...state};
      return updateDisplay(
        updateTactics(
          newState, 
          _ => ({points, height, description})),
        display => ({...display, editDescription, selected}));
    }
  };
  const scenario = isolate(Scenario, {onion: scenarioLens})(sources);

  const paginationLens = {
    get({tacticIdx, tactics}: State): pag.State {
      return {
        current: tacticIdx + 1, 
        pages: tactics.length
      };
    },
    set(state: State, {current, pages}: pag.State): State {
      return {...state, tacticIdx: current - 1};
    }
  };
  const paginationProps$ = xs.of({clone: cloneTactic}).remember();
  const pagination = isolate(Pagination, {onion: paginationLens})({...sources, props$: paginationProps$});
  const moveReducer$ = pagination.moveItem.map(
    ({from, to}) => state => {
      const tactics = moveItem(state.tactics, from, to);
      const display = moveItem(state.display, from, to);
      return {
        ...state,
        tacticIdx: to - 1,
        tactics,
        display
      };
    });
  const copyReducer$ = pagination.copyItem.map(
    ({item, to}) => state => {
      const tactics = copyItem(state.tactics, item, to, cloneTactic);
      const display = copyItem(state.display, item, to, () => DEFAULT_DISPLAY);
      return {
        ...state,
        tacticIdx: to - 1,
        tactics,
        display
      };
    });
  const deleteReducer$ = pagination.deleteItem.map(
    (idx) => state => {
      const tactics = deleteItem(state.tactics, idx);
      const display = deleteItem(state.display, idx);
      return {
        ...state,
        tacticIdx: Math.min(idx, tactics.length) - 1,
        tactics,
        display
      };
    });

  const tabChildren$: Stream<VNode[]> = xs.combine(
      state$,
      scenario.DOM,
      codec.DOM,
      pagination.DOM)
    .map(([state, scenario, codec, pagination]) => {
      debugger;
      const {tab} = getDisplay(state);
      switch (tab) {
        case Tab.FIELD:
        case Tab.VISION:
        case Tab.COMBO:
          return [pagination, scenario];
        case Tab.CODEC:
          return [codec];
        default:
          return [div(`Unknown tab ${tab}`)];
      }
    });
  const tabInfo = [
    Tab.FIELD,
    Tab.VISION,
    Tab.COMBO,
    Tab.CODEC
  ].map(t => ({tab: t, label: getTabName(t)}));
  const tabLens = {
    get(state: State): TabsState<Tab> {
      debugger;
      const {tab} = getDisplay(state);
      return {
        tab,
        tabs: tabInfo
      };
    },
    set(state: State, {tab}: TabsState<Tab>): State {
      debugger;
      return updateDisplay(state, d => ({...d, tab}));
    }
  };
  const tabs = isolate(Tabs, {onion: tabLens})({
    ...sources,
    children$: tabChildren$
  });
  
  const reducer$ = xs.merge(
    initialReducer$,
    scenario.onion,
    codec.onion,
    xs.merge(
      pagination.onion,
      moveReducer$,
      copyReducer$,
      deleteReducer$),
    tabs.onion);

  const vdom$ = xs.combine(
      state$,
      tabs.DOM)
    .map(([state, tabs]) => {
      return div(
      [
        div('Small browser application to display Ultimate tactics in 3D'),
        tabs
      ]);
    })
    .replaceError(() => xs.of(div(`Internal error`)));

  return {
    DOM: vdom$,
    onion: reducer$,
  };
};

Cycle.run(
  onionify(main),
  {DOM: makeDOMDriver('#app')});

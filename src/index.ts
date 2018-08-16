import xs, {Stream} from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, div, span, button, makeDOMDriver, i, table, DOMSource, VNode} from '@cycle/dom';
import onionify from 'cycle-onionify';
import isolate from '@cycle/isolate';
import 'aframe';
import 'aframe-environment-component';

import {Tab} from './components/tab';
import Codec from './components/codec';
import {Player as PlayerType, createPlayer, PlayerId} from './components/players';
import Player, {State as PlayerState} from './components/tactic-player';
import Listing, {State as ListingState} from './components/tactic-list';
import Help from './components/help';

type Tactic = {
  description: string,
  height: number,
  points: PlayerType[]
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
  showHelp: boolean,
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

const DEFAULT_DISPLAY: TacticDisplay = {
  tab: Tab.FIELD,
  editDescription: false
};
const getTactic: (s: State) => Tactic = (state) => state.tactics[state.tacticIdx];
const getDisplay: (s: State) => TacticDisplay = (state) => state.display[state.tacticIdx];

function main(sources: Sources): Sinks {
  const initialReducer$: Stream<(State) => State> = xs.of(() => ({
    mode: null,
    showHelp: false,
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

  const playerLens = {
    get(state: State): PlayerState {
      return state;
    },
    set(state: State, childState: PlayerState): State {
      return {...state, ...childState};
    }
  };
  const player = isolate(Player, {onion: playerLens})(sources);

  const listingLens = {
    get(state: State): ListingState {
      return state;
    },
    set(state: State, childState: ListingState): State {
      return {...state, ...childState};
    }
  };
  const listing = isolate(Listing, {onion: listingLens})(sources);

  const help = isolate(Help, 'showHelp')(sources);
  
  const reducer$ = xs.merge(
    initialReducer$,
    codec.onion,
    player.onion,
    listing.onion,
    help.onion);

  const state$ = sources.onion.state$;
  const vdom$ = xs.combine(
      state$,
      codec.DOM,
      player.DOM,
      listing.DOM,
      help.DOM)
    .map(([state, codec, player, listing, help]) => {
      const {mode} = state;
      const {tab} = getDisplay(state);
      const tabElements = mode === null
        ? [player, listing]
        : null;

      return div(
      [
        div('Small browser application to display Ultimate tactics in 3D'),
        help,
        codec,
        ...tabElements
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

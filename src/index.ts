import xs, {Stream} from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, div, span, button, makeDOMDriver, i, table, DOMSource, VNode} from '@cycle/dom';
import onionify, { Reducer, StateSource } from 'cycle-onionify';
import 'aframe';
import 'aframe-environment-component';

import isolate from './ext/re-isolate';
import {State, Tactic, TacticDisplay, DEFAULT_DISPLAY, getInitialState} from './state/initial';
import {Tab} from './components/tab';
import Codec, {State as CodecState, Mode as CodecMode} from './components/codec';
import {Player as PlayerType, createPlayer, PlayerId} from './components/players';
import Player, {State as PlayerState, Sinks as PlayerSinks} from './components/tactic-player';
import Listing, {State as ListingState, Sinks as ListingSinks} from './components/tactic-list';
import {updateItem, copyItem, moveItem, deleteItem} from './state/operators';
import Help from './components/help';

type Sources = {
  DOM: DOMSource,
  onion: StateSource<State>
};
type Sinks = {
  DOM: Stream<VNode>,
  onion: Stream<Reducer<State>>
};

const getTactic: (s: State) => Tactic = (state) => state.tactics[state.tacticIdx];
const getDisplay: (s: State) => TacticDisplay = (state) => state.display[state.tacticIdx];
const cloneTactic = ({height, description, points}) => ({
  height,
  description,
  points: points.map(p => ({...p}))
});

function main(sources: Sources): Sinks {
  const initialReducer$: Stream<Reducer<State>> = xs.of(() => getInitialState());

  const codecLens = {
    get({tactics, mode}: State): CodecState {
      return {
        payload: {tactics},
        mode
      };
    },
    set(state: State, {mode, payload}: CodecState): State {
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
  const codec = isolate(Codec, codecLens)(sources);

  const playerLens = {
    get(state: State): PlayerState {
      return state;
    },
    set(state: State, childState: PlayerState): State {
      return {...state, ...childState};
    }
  };
  const player = isolate(Player, playerLens)(sources) as PlayerSinks<State>;

  const listingLens = {
    get(state: State): ListingState {
      return state;
    },
    set(state: State, childState: ListingState): State {
      return {...state, ...childState};
    }
  };
  const listing = isolate(Listing, listingLens)(sources) as ListingSinks<State>;

  const moveReducer$ = xs.merge(
      player.moveItem,
      listing.moveItem)
    .map(({from, to}) => state => {
      const tactics = moveItem(state.tactics, from, to);
      const display = moveItem(state.display, from, to);
      return {
        ...state,
        tacticIdx: to - 1,
        tactics,
        display
      };
    });
  const copyReducer$ = xs.merge(
      player.copyItem,
      listing.copyItem)
    .map(({item, to}) => state => {
      const tactics = copyItem(state.tactics, item, to, cloneTactic);
      const display = copyItem(state.display, item, to, () => DEFAULT_DISPLAY);
      return {
        ...state,
        tacticIdx: to - 1,
        tactics,
        display
      };
    });
  const deleteReducer$ = xs.merge(
      player.deleteItem,
      listing.deleteItem)
    .map((idx) => state => {
      const tactics = deleteItem(state.tactics, idx);
      const display = deleteItem(state.display, idx);
      return {
        ...state,
        tacticIdx: Math.min(idx, tactics.length) - 1,
        tactics,
        display
      };
    });

  const help = isolate<any, any, Sources, Sinks>(Help, 'showHelp')(sources);

  const viewerReducer$ = xs.merge(
    sources.DOM.select('.player-view').events('click').mapTo('player'),
    sources.DOM.select('.listing-view').events('click').mapTo('listing'))
    .map(viewer => state => ({...state, viewer}));
  
  const reducer$ = xs.merge(
    initialReducer$,
    codec.onion,
    xs.merge(
      player.onion,
      moveReducer$,
      copyReducer$,
      deleteReducer$),
    listing.onion,
    help.onion,
    viewerReducer$);

  const state$ = sources.onion.state$;
  const vdom$ = xs.combine(
      state$,
      codec.DOM,
      player.DOM,
      listing.DOM,
      help.DOM)
    .map(([state, codec, player, listing, help]) => {
      const {mode, viewer} = state;
      const {tab} = getDisplay(state);
      const viewerToggle = div([
        button('.player-view', 'Player'),
        button('.listing-view', 'Listing')]);
      const viewerDOM = mode === null
        ? [viewerToggle, (viewer === 'listing' ? listing : player)]
        : null;

      return div([
        div('Small browser application to display Ultimate tactics in 3D'),
        help,
        codec,
        ...viewerDOM
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

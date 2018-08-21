import xs, {Stream} from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, div, span, button, makeDOMDriver, i, table, DOMSource, VNode} from '@cycle/dom';
import onionify, { StateSource, Reducer } from 'cycle-onionify';

import {Tab} from './tab';
import {IncDecButtons} from './buttons';
import {Scene} from './3d-vision';
import {Field} from './field';
import {Player, createPlayer, PlayerId} from './players';
import Description from './description';
import isolate from '../ext/re-isolate';

type State = {
  colors: string[],
  tab: Tab,
  editDescription: boolean,
  selected?: PlayerId,
  description: string,
  height: number,
  points: Player[]
};

type Sources = {
  onion: StateSource<State>,
  DOM: DOMSource
};
type Sinks = {
  DOM: Stream<VNode>,
  onion: Stream<Reducer<State>>
};

function Scenario(sources: Sources): Sinks {
  const heightProps$ = xs.of({
      text: 'Height',
      increment: 0.25,
      format: n => n.toFixed(2)
    }).remember();
  const heightInc = isolate(IncDecButtons, 'height')({
   ...sources,
   props$: heightProps$
  }) as Sinks;

  const fieldLens = {
    get: ({points, colors, selected}) => ({points, colors, selected}),
    set: (state, {points, selected}) => Object.assign({}, state, {points, selected})
  };
  const field = isolate(Field, fieldLens)(sources);

  const sceneLens = {
    get: ({height, points, colors}) => ({height, players: points, colors}),
    set: (state) => state
  };
  const scene = isolate(Scene, sceneLens)(sources);

  const descriptionLens = {
    get: ({description: value, editDescription: edit}) => ({value, edit}),
    set: (state, {value: description, edit: editDescription}) => ({...state, description, editDescription})
  };
  const description = isolate(Description, descriptionLens)(sources);
  
  const reducer$ = xs.merge(
    heightInc.onion,
    field.onion,
    description.onion);

  const state$ = sources.onion.state$;
  const vdom$ = xs.combine(
      state$,
      scene.DOM,
      heightInc.DOM,
      field.DOM,
      description.DOM)
    .map(([{tab}, scene, heightInc, field, description]) => {
      const tabElements = [];
      switch (tab) {
        case Tab.FIELD:
          tabElements.push(field);
          break;
        case Tab.VISION:
          tabElements.push(heightInc, scene);
          break;
        case Tab.COMBO:
          tabElements.push(field, heightInc, scene);
          break;
        default:
          tabElements.push(div(`Unknown tab ${tab}`));
      }

      return div([
        description,
        ...tabElements
      ]);
    })
    .replaceError(() => xs.of(div('Internal error in scenario')));

  return {
    DOM: vdom$,
    onion: reducer$,
  };
};

export default Scenario;
export {
  State
};

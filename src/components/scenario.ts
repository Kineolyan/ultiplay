import xs, {Stream} from 'xstream';
import {div, DOMSource, VNode} from '@cycle/dom';
import { StateSource, Reducer } from 'cycle-onionify';

import {Tab} from './tab';
import {IncDecButtons} from './buttons';
import {Scene} from './3d-vision';
import {Field, State as FieldState} from './field';
import {Player, PlayerId} from './players';
import Description from './description';
import isolate from '../ext/re-isolate';
import { FieldType } from '../state/initial';

type State = {
  colors: string[],
  tab: Tab,
  editDescription: boolean,
  selected?: PlayerId,
  description: string,
  height: number,
  points: Player[],
  fieldType: FieldType
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
    get({points, colors, selected, fieldType}: State): FieldState {
      return {
        points, 
        colors, 
        selected,
        fieldType
      };
    },
    set(state: State, {points, selected, fieldType}: FieldState): State {
      return {
        ...state, 
        points, 
        selected,
        fieldType
      };
    }
  };
  const field = isolate(Field, fieldLens)(sources);

  const sceneLens = {
    get({height, points, colors}) {
      return {height, players: points, colors}
    },
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

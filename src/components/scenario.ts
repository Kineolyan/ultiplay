import xs, {Stream} from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, div, span, button, makeDOMDriver, i, table, DOMSource, VNode} from '@cycle/dom';
import onionify from 'cycle-onionify';
import isolate from '@cycle/isolate';
import 'aframe';
import 'aframe-environment-component';

import {Tab} from './tab';
import {IncDecButtons} from './buttons';
import {Scene} from './3d-vision';
import {Field} from './field';
import Codec from './codec';
import {Player, createPlayer, PlayerId} from './players';
import Description from './description';

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
  onion: {
    state$: Stream<State>
  },
  DOM: DOMSource
};
type Sinks = {
  DOM: Stream<VNode>,
  onion: Stream<any>
};

function Scenario(sources: Sources): Sinks {
  const HeightInc = isolate(IncDecButtons, 'height');
  const heightProps$ = xs.of({
      text: 'Height',
      increment: 0.25
    }).remember();
  const heightInc = HeightInc(
    Object.assign({}, sources, {props$: heightProps$}));

  const fieldLens = {
    get: ({points, colors, selected}) => ({points, colors, selected}),
    set: (state, {points, selected}) => Object.assign({}, state, {points, selected})
  };
  const field = isolate(Field, {onion: fieldLens})(sources);

  const sceneLens = {
    get: ({height, points, colors}) => ({height, players: points, colors}),
    set: (state) => state
  };
  const scene = isolate(Scene, {onion: sceneLens})(sources);

  const descriptionLens = {
    get: ({description: value, editDescription: edit}) => ({value, edit}),
    set: (state, {value: description, edit: editDescription}) => ({...state, description, editDescription})
  };
  const description = isolate(Description, {onion: descriptionLens})(sources);
  
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
        case Tab.CODEC:
          tabElements.push(div(`Cannot display codec tab`));
          break;
        default:
          tabElements.push(div(`Unknown tab ${tab}`));
      }

      return div(
      [
        div('Small browser application to display Ultimate tactics in 3D'),
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

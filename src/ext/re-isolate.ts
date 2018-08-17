import {Stream} from 'xstream';
import isolate, {Component} from '@cycle/isolate';
import { Lens, StateSource, Reducer } from 'cycle-onionify';
import { DOMSource, VNode } from '@cycle/dom';

function isString(value: any): value is string {
  return typeof value === 'string';
}

type StandardSources<T> = {
  DOM: DOMSource
  onion: StateSource<T>
};
type StandardSinks<T> = {
  DOM: Stream<VNode>,
  onion: Stream<Reducer<T>>
};

function reisolate<InnerSo, InnerSi>(component: Component<InnerSo, InnerSi>): Component<InnerSo, InnerSi>;
function reisolate<InnerSo, InnerSi, OuterSo, OuterSi>(component: Component<InnerSo, InnerSi>, scope: string): Component<OuterSo, OuterSi>;
function reisolate<
    InnerSo, 
    InnerSi, 
    InnerState, 
    OuterState, 
    ESSo extends StandardSources<OuterState>,
    ESSi extends StandardSinks<OuterState>>(
  component: Component<InnerSo, InnerSi>, 
  scope: Lens<OuterState, InnerState>): 
    Component<ESSo,  ESSi>;
function reisolate<
    InnerSo, 
    InnerSi, 
    OuterSo, 
    OuterSi,
    InnerState, 
    OuterState, 
    ESSo extends StandardSources<OuterState>,
    ESSi extends StandardSinks<OuterState>>(
  component: Component<InnerSo, InnerSi>, 
  scope?: string | Lens<OuterState, InnerState>): 
    Component<InnerSo, InnerSi> | Component<OuterSo, OuterSi> | Component<ESSo,  ESSi> {
  if (scope === undefined) {
    return isolate(component) as Component<InnerSo, InnerSi>;
  } else if (isString(scope)) {
    const cpn = isolate(component, scope) as Component<OuterSo, OuterSi>;
    return (sources: OuterSo) => cpn(sources);
  } else {
    const cpn = isolate(component, {onion: scope}) as Component<ESSo,  ESSi>;
    return (sources: ESSo) => cpn(sources);
  }
}
export default reisolate;
export {
  Component
};

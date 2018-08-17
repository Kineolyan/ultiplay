import {Stream} from 'xstream';
import isolate, {Component} from '@cycle/isolate';
import { Lens, StateSource, Reducer } from 'cycle-onionify';
import { DOMSource } from '@cycle/dom';

function isString(value: any): value is string {
  return typeof value === 'string';
}

type StandardSources<T> = {
  DOM: DOMSource
  onion: StateSource<T>
}
type StandardSinks<T> = {
  DOM: DOMSource
  onion: Stream<Reducer<T>>
}

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
    return isolate(component, scope) as Component<OuterSo, OuterSi>;
  } else {
    return isolate(component, {onion: scope}) as Component<ESSo,  ESSi>;
  }
}
export default reisolate;
export {
  Component
};

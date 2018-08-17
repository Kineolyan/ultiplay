import isolate, {Component} from '@cycle/isolate';
import { Lens } from 'cycle-onionify';

function isString(value: any): value is string {
  return typeof value === 'string';
}

function reisolate<InnerSo, InnerSi, InnerState, OuterState>(component: Component<InnerSo, InnerSi>, scope?: string | Lens<OuterState, InnerState>): Component<InnerSo, InnerSi> {
  if (scope === undefined) {
    return isolate(component) as Component<InnerSo, InnerSi>;
  } else if (isString(scope)) {
    return isolate(component, scope) as Component<InnerSo, InnerSi>;
  } else {
    return isolate(component, {onion: scope}) as Component<InnerSo, InnerSi>;
  }
}
export default reisolate;
export {
  Component
};

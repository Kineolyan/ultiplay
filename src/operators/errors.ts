import xs from 'xstream';
import {div} from '@cycle/dom';

const errorView = (name: string) => (e: Error) => {
  console.error(`Error rendering ${name}`, e);
  return xs.of(div(`Error in ${name}: ${e.message}`));
};

export {
  errorView
};

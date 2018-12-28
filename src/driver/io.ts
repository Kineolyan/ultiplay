import xs from 'xstream';
import {adapt} from '@cycle/run/lib/adapt';

type Operation = 'export';
type IOAction = {
  operation: Operation,
  content: string
};

const makeIODriver = (outgoing$) => {
  outgoing$.addListener({
    next: outgoing => {
      console.log('IO operation', outgoing);
    },
    error: () => {},
    complete: () => {},
  });

  const incoming$ = xs.create({
    start: listener => {
      console.log('No evetn are produced. Should not listen to IO');
      return null;
    },
    stop: () => {},
  });

  return adapt(incoming$);
};

export default makeIODriver;
export {
  Operation,
  IOAction
};

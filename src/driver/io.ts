import xs, {Stream} from 'xstream';
import {adapt} from '@cycle/run/lib/adapt';

type Operation = 'export';
type IOAction = {
  operation: Operation,
  content: string
};

const keepNotebookElements = (node: HTMLElement) => {
  const children = node.children;
  let count = children.length;
  let i = 0;
  while (i < count) {
    const child = children[i];
    if (child.dataset.notebook !== 'true') {
      node.removeChild(child);
      count -= 1;
    } else {
      i += 1;
    }
  }
};

const setNotebookScript = (body: HTMLBodyElement, script: string) => {
  const children = body.children;
  const count = children.length;
  for (let i = 0; i < count; i += 1) {
    const child = children[i];
    if (child.id === 'notebook-script') {
      child.textContent = script;
      return;
    }
  }
};

const setupAbsoluteLinks = (header: HTMLHeadElement, body: HTMLBodyElement) => {

}

const createNotebook = (script: string) => {
  const notebook = document.documentElement.cloneNode(true);
  const header = notebook.getElementsByTagName('head')[0];
  keepNotebookElements(header);
  const body = notebook.getElementsByTagName('body')[0];
  keepNotebookElements(body);
  setNotebookScript(body, script);
  setupAbsoluteLinks(header, body);
  // TODO: restore div#app element

  return notebook.outerHTML;
}

const makeIODriver = () => (outgoing$: Stream<IOAction>) => {
  outgoing$.addListener({
    next: action => {
      console.log('IO operation', action);
      if (action.operation === 'export') {
        const element = document.createElement('a');
        try {
          const content = createNotebook(action.content);
          // console.log('generated notebook', content);
          element.setAttribute(
            'href',
            'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
          element.setAttribute('download', 'notebook.html');

          element.style.display = 'none';
          document.body.appendChild(element);

          // TODO: restore for download
          element.click();
        } finally {
          document.body.removeChild(element);
        }
      } else {
        console.error('Unsupported operation received', action);
      }
    },
    error: () => {},
    complete: () => {},
  });

  const incoming$: Stream<any> = xs.create({
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

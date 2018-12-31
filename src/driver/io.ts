import xs, {Stream} from 'xstream';
import {adapt} from '@cycle/run/lib/adapt';

type Operation = 'export';
type IOAction = {
  operation: Operation,
  content: string
};

const forEachChild = (node: HTMLElement, action: (HTMLElement) => void | boolean) => {
  const children = node.children;
  let count = children.length;
  let i = 0;
  while (i < count) {
    const child = children[i];
    if (action(child) === false) {
      return false;
    }
    if (child === children[i]) {
      i += 1;
    } else {
      // Element removed, update the count
      count -= 1;
    }
  }
  return true;
}

const keepNotebookElements = (node: HTMLElement) => {
  forEachChild(node, child => {
    if (child.dataset.notebook !== 'true') {
      node.removeChild(child);
    }
  });
};

const setNotebookScript = (body: HTMLBodyElement, script: string) => {
  forEachChild(body, child => {
    if (child.id === 'notebook-script') {
      child.textContent = script;
      return false;
    }
  });
};

const computeBaseUrl = () => {
  const url = window.location.href;
  // Remove the index.html part if any
  const match = /(.+)(?:\/index.html\?.+)/.exec(url);
  if (match) {
    // Ensure that it is truly at the end of the file
    return match[1];
  } else {
    // Return the url as is
    return url;
  }
};

const getBaseUrl = (() => {
  let base = null;
  return () => {
    if (base === null) {
      base = computeBaseUrl();
    }
    return base;
  }
})();

const updateLink = (value: string | undefined, updateCbk: (string) => void) => {
  if (value != null && !value.startsWith('http')) {
    const base = getBaseUrl();
    const updatedValue = `${base}/${value}`
      // Remove potential duplicated double slashes
      .replace(/(\w)\/\/(\w)/g, '$1/$2');
    updateCbk(updatedValue);
    return true;
  } else {
    return false;
  }
}

const turnLinkToAbsolute = (node: HTMLElement) => {
  const href = node.getAttribute('href');
  updateLink(href, newHref => node.setAttribute('href', newHref));

  const src = node.getAttribute('src');
  updateLink(src, newSrc => node.setAttribute('src', newSrc));
}

const setupAbsoluteLinks = (header: HTMLHeadElement, body: HTMLBodyElement) => {
  forEachChild(header, turnLinkToAbsolute);
  forEachChild(body, turnLinkToAbsolute);
}

const restoreAppElement = (body: HTMLBodyElement) => {
  // Check that the element is not in the children list
  const noDivApp = forEachChild(body, child => child.id !== 'app');
  if (noDivApp) {
    // The children do not include div#app
    const appNode = document.createElement('div');
    appNode.id = 'app';
    body.insertBefore(appNode, body.firstChild);
  }
}

const createNotebook = (script: string) => {
  const notebook = document.documentElement.cloneNode(true);
  const header = notebook.getElementsByTagName('head')[0];
  keepNotebookElements(header);
  const body = notebook.getElementsByTagName('body')[0];
  keepNotebookElements(body);
  setNotebookScript(body, script);
  setupAbsoluteLinks(header, body);
  restoreAppElement(body);

  return notebook.outerHTML;
}

const makeIODriver = () => (outgoing$: Stream<IOAction>) => {
  outgoing$.addListener({
    next: action => {
      if (action.operation === 'export') {
        const element = document.createElement('a');
        const content = createNotebook(action.content);
          element.setAttribute(
            'href',
            'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
          element.setAttribute('download', 'notebook.html');
          element.style.display = 'none';

        try {
          document.body.appendChild(element);
          element.click();
        } finally {
          document.body.removeChild(element);
        }
      } else {
        console.error('Unsupported operation received', action);
      }
    },
    error: (e) => {
      console.error('Error while exporting a notebook', e);
    },
    complete: () => {},
  });

  const incoming$: Stream<any> = xs.create({
    start: listener => {
      console.log('No event are produced. Should not listen to IO');
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

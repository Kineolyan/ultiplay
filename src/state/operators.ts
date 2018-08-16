function updateItem<T>(elements: T[], idx: number, f: (T) => T): T[] {
  const copy = elements.slice();
  copy[idx] = f(elements[idx]);
  return copy;
}

function moveItem<T>(elements: T[], from: number, to: number): T[] {
  if (from < to) {
    const copy = elements.slice();
    copy.splice(to, 0, elements[from - 1]);
    copy.splice(from - 1, 1);
    return copy;
  } else if (to < from) {
    const copy = elements.slice();
    copy.splice(from - 1, 1);
    copy.splice(to - 1, 0, elements[from - 1]);
    return copy;
  } else {
    return elements;
  }
}

function copyItem<T>(elements: T[], from: number, to: number, clone: (T) => T): T[] {
  const newItem = clone(elements[from - 1]);
  const copy = elements.slice();
  copy.splice(to - 1, 0, newItem);
  return copy;
}

function deleteItem<T>(elements: T[], item: number) {
  if (item < elements.length) {
    const copy = elements.slice();
    copy.splice(item - 1, 1);
    return copy;
  } else if (elements.length > 1) {
    // Last page of many
    const copy = elements.slice(0, item - 1);
    return copy;
  } else {
    // Last only page
    throw new Error('Cannot remove the last element');
  }
}

export {
  updateItem,
  moveItem,
  copyItem,
  deleteItem
};

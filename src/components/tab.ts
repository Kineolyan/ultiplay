enum Tab {
  FIELD,
  VISION,
  COMBO
};

function getTabName(tab: Tab): string {
  switch (tab) {
    case Tab.FIELD: return 'Field';
    case Tab.VISION: return '3D vision';
    case Tab.COMBO: return 'Combo view';
    default: throw new Error(`Unsported enum value ${tab}`);
  }
}

export {
  Tab,
  getTabName
};

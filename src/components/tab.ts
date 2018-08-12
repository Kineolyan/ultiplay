enum Tab {
  FIELD,
  VISION,
  COMBO,
  CODEC
};

function getTabName(tab: Tab): string {
  switch (tab) {
  case Tab.FIELD: return 'Field';
  case Tab.VISION: return '3D vision';
  case Tab.COMBO: return 'Combo view';
  case Tab.CODEC: return 'Import/Export';
  default: throw new Error(`Unsported enum value ${tab}`);
  }
}

export {
  Tab,
  getTabName
};

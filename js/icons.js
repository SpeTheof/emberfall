// ============================================================
// EMBERFALL — inline SVG icon set
// ============================================================

const PATHS = {
  whirlwind: '<path d="M20 12a8 8 0 1 1-2.3-5.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M20 3v5h-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7.2l1.1 3.1 3.2 1.1-3.2 1.1L12 15.6l-1.1-3.1-3.2-1.1 3.2-1.1z" fill="currentColor"/>',
  flame: '<path d="M12 2.5c.8 3.4 3.4 4.6 4.9 7.1 1.2 2 .9 4.4-.6 6.1-1.5 1.8-4 2.4-6.2 1.6-2.7-.9-4.3-3.6-3.7-6.4.5-2.3 2.2-3.6 3.3-5.4.5-.9.9-1.9 2.3-3Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 10.2c.6 1.3 1.4 2 1.4 3.3a2.3 2.3 0 0 1-4.6 0c0-1.2.9-1.8 1.5-2.7.5-.7.8-1.2 1.7-.6Z" fill="currentColor"/>',
  arrows: '<path d="M6 3v13M3.4 13.4 6 16l2.6-2.6M12 5v14M9.4 16.4 12 19l2.6-2.6M18 3v13M15.4 13.4 18 16l2.6-2.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  sword: '<path d="M5 19l2.2-2.2M6.5 17.5 17 7M17 7l1.8-3.8L22 6.2 18.8 8M5.5 15.5l3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  shield: '<path d="M12 2.8 20 6v6c0 4.7-3.3 7.8-8 9.2-4.7-1.4-8-4.5-8-9.2V6z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 6.5v9M8.5 10.5h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  heart: '<path d="M12 21s-8.2-4.8-9.3-10.4C1.8 6.3 5.5 3.4 8.8 4.6c1.7.6 2.8 2 3.2 3.1.4-1.1 1.5-2.5 3.2-3.1 3.3-1.2 7 1.7 6.1 6C20.2 16.2 12 21 12 21Z" fill="currentColor"/>',
  coin: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 9.5h6M9 12h6M12 8v8M9.5 16h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="15" r="1.4" fill="currentColor"/>',
  check: '<path d="M4 12.5 9.2 18 20 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  chevron: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  skull: '<path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.2 4.5 3 5.8V20h9v-3.7c1.8-1.3 3-3.2 3-5.8A7.5 7.5 0 0 0 12 3Z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="9" cy="10.5" r="1.2" fill="currentColor"/><circle cx="15" cy="10.5" r="1.2" fill="currentColor"/><path d="M10 16h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H3.5v1.5A3.5 3.5 0 0 0 7 11M17 6h3.5v1.5A3.5 3.5 0 0 1 17 11M12 14v4M8 21h8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 7v5.5l3.5 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  star: '<path d="M12 2.8l2.5 6.1 6.5.5-5 4.2 1.6 6.3-5.6-3.4L6.4 20l1.6-6.3-5-4.2 6.5-.5z" fill="currentColor"/>',
  close: '<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  spark: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" fill="currentColor"/>',
  chest: '<path d="M3.5 10h17v9h-17zM3.5 10 5 5.5h14L20.5 10M12 5.5V19M9 13h6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  arrowDown: '<path d="M12 4v14M6.5 12.5 12 18l5.5-5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  armor: '<path d="M8 3.5 12 5l4-1.5 4 3-1.5 5.5-2.5-1v9H8v-9L5.5 12 4 6.5z" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"/><path d="M12 5v6M9.5 8.5h5" stroke="currentColor" stroke-width="1.2" opacity=".6"/>',
  robe: '<path d="M9 3.5 12 4.5l3-1 2 4-2 3 4 10H5L9 10.5l-2-3z" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"/><path d="M12 4.5V10M9 10.5h6" stroke="currentColor" stroke-width="1.2" opacity=".6"/>',
  leather: '<path d="M8 4h8l2 4-2 3v8H8v-8L6 8z" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"/><path d="M8 8h8M12 11v6" stroke="currentColor" stroke-width="1.2" opacity=".6"/>',
};

export function icon(name, cls = '') {
  const body = PATHS[name] || PATHS.spark;
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

export function skillIcon(name) {
  return icon(name === 'whirlwind' ? 'whirlwind' : name === 'flame' ? 'flame' : name === 'arrows' ? 'arrows' : 'spark');
}

// gear icon HTML: weapons use the actual game sprites, armour uses SVG
export function gearIconHTML(iconName, assets) {
  if (iconName === 'bow') {
    return `<img class="pixel" src="${assets.icons.bow}" alt="">`;
  }
  if (iconName === 'staff') {
    return `<img class="pixel" src="${assets.tiny[129]?.src || ''}" alt="">`;
  }
  if (iconName === 'greatsword' || iconName === 'sword') {
    return `<img class="pixel" src="${assets.tiny[104]?.src || ''}" alt="">`;
  }
  return icon(iconName === 'armor' ? 'armor' : iconName === 'robe' ? 'robe' : 'leather');
}

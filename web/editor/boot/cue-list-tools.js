// 字幕列表工具条：颜色筛选菜单与下拉、搜索框与清除按钮，末尾是视觉缓存失效探针。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。

MaweColorFilter.renderColorFilterMenu();
MaweExportMenus.bindToolbarExportDropdown(
  'color-filter-dropdown', 'color-filter-btn', 'color-filter-menu',
  MaweColorFilter.positionColorFilterMenu,
);
MaweDom.searchEl.addEventListener('input', () => {
  MaweSearch.refreshSearchClearVisibility();
  clearTimeout(MaweSearch.searchDebounce);
  MaweSearch.searchDebounce = setTimeout(() => MaweSearch.applySearch(MaweDom.searchEl.value), 100);
});
document.getElementById('search-clear')?.addEventListener('click', () => {
  MaweDom.searchEl.value = '';
  MaweSearch.refreshSearchClearVisibility();
  MaweSearch.applySearch('');
  MaweDom.searchEl.focus({ preventScroll: true });
});

document.addEventListener('pointerdown', MaweCueListAnchor.invalidateCueListVisualAnchorRestore, true);
MaweCoreState.container.addEventListener('wheel', MaweCueListAnchor.invalidateCueListVisualAnchorRestore, { passive: true });
MaweCoreState.container.addEventListener('touchstart', MaweCueListAnchor.invalidateCueListVisualAnchorRestore, { passive: true });
document.addEventListener('keydown', MaweCueListAnchor.invalidateCueListVisualAnchorRestore, true);

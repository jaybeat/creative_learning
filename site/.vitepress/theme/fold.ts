/**
 * 长代码折叠的客户端部分：给构建期标了 data-fold 的代码块加 is-folded class 和「展开全部」按钮。
 * 没有 JS 时这里不会运行，代码默认全部展开。
 */
export function setupFolding(root: ParentNode = document): void {
  const boxes = root.querySelectorAll<HTMLElement>('[data-fold]:not([data-fold-ready])')
  for (const box of boxes) {
    box.dataset.foldReady = '1'
    box.classList.add('is-folded')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'fold-toggle'
    btn.textContent = `展开全部（共 ${box.dataset.fold} 行）`
    btn.addEventListener('click', () => {
      box.classList.remove('is-folded')
      btn.remove()
    })
    box.appendChild(btn)
  }
}

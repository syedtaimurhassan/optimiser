import { useEffect } from 'react'

/**
 * Body scroll lock, reference-counted.
 *
 * A counter rather than a boolean because overlays stack: the routes drawer
 * can be open underneath an overflow sheet, which can itself be open
 * underneath a delete confirmation. Whichever unmounts first must not hand
 * scrolling back to the page while the others are still up.
 */
let lockCount = 0

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (lockCount === 0) document.body.style.overflow = 'hidden'
    lockCount += 1
    return () => {
      lockCount -= 1
      if (lockCount === 0) document.body.style.overflow = ''
    }
  }, [active])
}

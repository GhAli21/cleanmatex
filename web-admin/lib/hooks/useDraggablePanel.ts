'use client'

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

interface DragOffset {
  x: number
  y: number
}

interface DragSession {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

export interface UseDraggablePanelResult {
  offset: DragOffset
  resetPosition: () => void
  dragHandleProps: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
    role: 'button'
    tabIndex: number
    'aria-grabbed': boolean
    className: string
  }
}

/**
 * Pointer-driven drag offset for a fixed, center-anchored panel.
 * Attach returned handle props to the panel title bar only.
 */
export function useDraggablePanel(): UseDraggablePanelResult {
  const [offset, setOffset] = useState<DragOffset>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const sessionRef = useRef<DragSession | null>(null)

  const resetPosition = useCallback(() => {
    setOffset({ x: 0, y: 0 })
    sessionRef.current = null
    setIsDragging(false)
  }, [])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return

    const target = event.target as HTMLElement
    if (target.closest('button, a, input, textarea, select, [data-no-drag]')) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    sessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    }
    setIsDragging(true)

    const handleMove = (moveEvent: PointerEvent) => {
      const session = sessionRef.current
      if (!session || moveEvent.pointerId !== session.pointerId) return

      const dx = moveEvent.clientX - session.startX
      const dy = moveEvent.clientY - session.startY
      setOffset({
        x: session.originX + dx,
        y: session.originY + dy,
      })
    }

    const handleUp = (upEvent: PointerEvent) => {
      const session = sessionRef.current
      if (!session || upEvent.pointerId !== session.pointerId) return

      sessionRef.current = null
      setIsDragging(false)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
  }, [offset.x, offset.y])

  return {
    offset,
    resetPosition,
    dragHandleProps: {
      onPointerDown,
      role: 'button',
      tabIndex: 0,
      'aria-grabbed': isDragging,
      className: `select-none touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`,
    },
  }
}

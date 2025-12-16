"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TooltipProps {
  children: React.ReactNode
  content: string
  side?: "top" | "right" | "bottom" | "left"
  delayDuration?: number
  className?: string
}

export function Tooltip({
  children,
  content,
  side = "top",
  delayDuration = 200,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const tooltipRef = React.useRef<HTMLDivElement>(null)
  const timeoutRef = React.useRef<NodeJS.Timeout>()

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
      updatePosition()
    }, delayDuration)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()

    let x = 0
    let y = 0

    switch (side) {
      case "top":
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
        y = triggerRect.top - tooltipRect.height - 8
        break
      case "bottom":
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
        y = triggerRect.bottom + 8
        break
      case "left":
        x = triggerRect.left - tooltipRect.width - 8
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
        break
      case "right":
        x = triggerRect.right + 8
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
        break
    }

    // Keep tooltip within viewport
    const padding = 8
    x = Math.max(padding, Math.min(x, window.innerWidth - tooltipRect.width - padding))
    y = Math.max(padding, Math.min(y, window.innerHeight - tooltipRect.height - padding))

    setPosition({ x, y })
  }

  React.useEffect(() => {
    if (isVisible) {
      updatePosition()
      const handleResize = () => updatePosition()
      const handleScroll = () => updatePosition()
      window.addEventListener("resize", handleResize)
      window.addEventListener("scroll", handleScroll, true)
      return () => {
        window.removeEventListener("resize", handleResize)
        window.removeEventListener("scroll", handleScroll, true)
      }
    }
  }, [isVisible, side])

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={triggerRef}
      className="inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            "fixed z-[1070] rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md border pointer-events-none",
            "animate-in fade-in-0 zoom-in-95",
            className
          )}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
          role="tooltip"
        >
          {content}
          <div
            className={cn(
              "absolute w-2 h-2 bg-popover border rotate-45",
              side === "top" && "bottom-[-4px] left-1/2 -translate-x-1/2 border-t-0 border-r-0",
              side === "bottom" && "top-[-4px] left-1/2 -translate-x-1/2 border-b-0 border-l-0",
              side === "left" && "right-[-4px] top-1/2 -translate-y-1/2 border-l-0 border-b-0",
              side === "right" && "left-[-4px] top-1/2 -translate-y-1/2 border-r-0 border-t-0"
            )}
          />
        </div>
      )}
    </div>
  )
}


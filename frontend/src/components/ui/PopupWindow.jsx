import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, Minimize2, Square } from "lucide-react";
import { useT } from "../../context/LocaleContext";

/**
 * Popup Window System
 * - Draggable and resizable floating window
 * - Supports screen sharing and video content
 * - Always-on-top behavior
 * - Proper content scaling on resize
 */
export default function PopupWindow({
  isOpen,
  onClose,
  title,
  children,
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 400, height: 300 },
  minSize = { width: 200, height: 150 },
  maxSize = { width: 1200, height: 800 },
  isResizable = true,
  isDraggable = true,
  alwaysOnTop = true,
  className = "",
}) {
  const t = useT();
  const windowTitle = title ?? t("Popup");
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const windowRef = useRef(null);
  
  // Handle drag start
  const handleDragStart = useCallback((e) => {
    if (!isDraggable || isMaximized) return;
    
    setIsDragging(true);
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    
    e.preventDefault();
  }, [isDraggable, isMaximized, position]);
  
  // Handle resize start
  const handleResizeStart = useCallback((e, direction) => {
    if (!isResizable || isMaximized) return;
    
    setIsResizing(true);
    setResizeDirection(direction);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };
    
    e.preventDefault();
    e.stopPropagation();
  }, [isResizable, isMaximized, size]);
  
  // Handle mouse move for drag and resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newX = e.clientX - dragOffsetRef.current.x;
        const newY = e.clientY - dragOffsetRef.current.y;
        
        // Keep window within viewport bounds
        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - 40;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      }
      
      if (isResizing) {
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;
        
        let newWidth = resizeStartRef.current.width;
        let newHeight = resizeStartRef.current.height;
        let newX = position.x;
        let newY = position.y;
        
        // Handle different resize directions
        if (resizeDirection.includes('e')) {
          newWidth = Math.min(maxSize.width, Math.max(minSize.width, resizeStartRef.current.width + deltaX));
        }
        if (resizeDirection.includes('w')) {
          newWidth = Math.min(maxSize.width, Math.max(minSize.width, resizeStartRef.current.width - deltaX));
          newX = position.x + deltaX;
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.min(maxSize.height, Math.max(minSize.height, resizeStartRef.current.height + deltaY));
        }
        if (resizeDirection.includes('n')) {
          newHeight = Math.min(maxSize.height, Math.max(minSize.height, resizeStartRef.current.height - deltaY));
          newY = position.y + deltaY;
        }
        
        setSize({ width: newWidth, height: newHeight });
        if (resizeDirection.includes('w') || resizeDirection.includes('n')) {
          setPosition({ x: newX, y: newY });
        }
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection(null);
    };
    
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, resizeDirection, position, size, minSize, maxSize]);
  
  // Handle maximize toggle
  const handleMaximize = useCallback(() => {
    if (isMaximized) {
      setSize(initialSize);
      setPosition(initialPosition);
      setIsMaximized(false);
    } else {
      setSize({ width: window.innerWidth, height: window.innerHeight - 40 });
      setPosition({ x: 0, y: 0 });
      setIsMaximized(true);
    }
  }, [isMaximized, initialSize, initialPosition]);
  
  // Reset position when window is resized
  useEffect(() => {
    const handleWindowResize = () => {
      if (isMaximized) {
        setSize({ width: window.innerWidth, height: window.innerHeight - 40 });
        setPosition({ x: 0, y: 0 });
      } else {
        // Ensure window stays within bounds
        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - 40;
        setPosition(prev => ({
          x: Math.max(0, Math.min(prev.x, maxX)),
          y: Math.max(0, Math.min(prev.y, maxY)),
        }));
      }
    };
    
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [isMaximized, size]);
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        ref={windowRef}
        className={`popup-window ${className}`}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          zIndex: alwaysOnTop ? 9999 : 1000,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {/* Header - Drag Handle */}
        <div
          className="popup-header"
          onMouseDown={handleDragStart}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--panel-2)',
            borderBottom: '1px solid var(--border)',
            cursor: isDraggable && !isMaximized ? 'move' : 'default',
            userSelect: 'none',
          }}
        >
          <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: 14 }}>
            {windowTitle}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleMaximize}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}
              title={isMaximized ? t("Restore") : t("Maximize")}
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}
              title={t("Close")}
            >
              <X size={16} />
            </button>
          </div>
        </div>
        
        {/* Content Area */}
        <div
          className="popup-content"
          style={{
            flex: 1,
            overflow: 'auto',
            position: 'relative',
          }}
        >
          {children}
        </div>
        
        {/* Resize Handles */}
        {isResizable && !isMaximized && (
          <>
            {/* Corner resize handles */}
            <div
              onMouseDown={(e) => handleResizeStart(e, 'se')}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 16,
                height: 16,
                cursor: 'se-resize',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  width: 8,
                  height: 8,
                  borderRight: '2px solid var(--muted)',
                  borderBottom: '2px solid var(--muted)',
                }}
              />
            </div>
            
            <div
              onMouseDown={(e) => handleResizeStart(e, 'sw')}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: 16,
                height: 16,
                cursor: 'sw-resize',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: 4,
                  width: 8,
                  height: 8,
                  borderLeft: '2px solid var(--muted)',
                  borderBottom: '2px solid var(--muted)',
                }}
              />
            </div>
            
            <div
              onMouseDown={(e) => handleResizeStart(e, 'ne')}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 16,
                height: 16,
                cursor: 'ne-resize',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 8,
                  height: 8,
                  borderRight: '2px solid var(--muted)',
                  borderTop: '2px solid var(--muted)',
                }}
              />
            </div>
            
            <div
              onMouseDown={(e) => handleResizeStart(e, 'nw')}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 16,
                height: 16,
                cursor: 'nw-resize',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  width: 8,
                  height: 8,
                  borderLeft: '2px solid var(--muted)',
                  borderTop: '2px solid var(--muted)',
                }}
              />
            </div>
            
            {/* Edge resize handles */}
            <div
              onMouseDown={(e) => handleResizeStart(e, 'n')}
              style={{
                position: 'absolute',
                top: 0,
                left: 16,
                right: 16,
                height: 4,
                cursor: 'n-resize',
                zIndex: 10,
              }}
            />
            
            <div
              onMouseDown={(e) => handleResizeStart(e, 's')}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 16,
                right: 16,
                height: 4,
                cursor: 's-resize',
                zIndex: 10,
              }}
            />
            
            <div
              onMouseDown={(e) => handleResizeStart(e, 'w')}
              style={{
                position: 'absolute',
                top: 16,
                left: 0,
                bottom: 16,
                width: 4,
                cursor: 'w-resize',
                zIndex: 10,
              }}
            />
            
            <div
              onMouseDown={(e) => handleResizeStart(e, 'e')}
              style={{
                position: 'absolute',
                top: 16,
                right: 0,
                bottom: 16,
                width: 4,
                cursor: 'e-resize',
                zIndex: 10,
              }}
            />
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

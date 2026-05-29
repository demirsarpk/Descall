import { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const isElectron = window.electronAPI?.isElectron;

  useEffect(() => {
    if (!isElectron) return;

    // Add electron-app class to body for padding
    document.body.classList.add('electron-app');

    // Listen for maximize state changes from main process
    if (window.electronAPI?.onMaximizedChange) {
      window.electronAPI.onMaximizedChange((maximized) => {
        setIsMaximized(maximized);
      });
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('electron-app');
    };
  }, [isElectron]);

  // Don't render if not in Electron
  if (!isElectron) return null;

  const handleMinimize = () => window.electronAPI?.minimizeWindow?.();
  
  const handleMaximize = () => {
    window.electronAPI?.maximizeWindow?.();
  };
  
  const handleClose = () => window.electronAPI?.closeWindow?.();

  return (
    <div 
      className="titlebar"
      style={{
        height: '40px',
        background: '#1a1b1e',
        borderBottom: '1px solid #2f3136',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        WebkitAppRegion: 'drag', // Draggable area
        userSelect: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
      }}
    >
      {/* Left - Logo and Title */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        WebkitAppRegion: 'no-drag'
      }}>
        {/* Descall Logo */}
        <div style={{
          width: 32,
          height: 32,
          background: 'linear-gradient(135deg, #5865f2 0%, #4752c4 50%, #3b45a3 100%)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#fff',
          boxShadow: '0 2px 8px rgba(88, 101, 242, 0.4)',
          border: '2px solid rgba(255,255,255,0.1)',
        }}>
          D
        </div>
        <span style={{ 
          color: '#fff', 
          fontSize: '15px', 
          fontWeight: 700,
          letterSpacing: '0.5px'
        }}>
          Descall
        </span>
        
      </div>

      {/* Right - Window Controls (Windows Style) */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        WebkitAppRegion: 'no-drag'
      }}>

        {/* Minimize - Windows Style */}
        <button 
          onClick={handleMinimize}
          className="win-btn minimize"
          style={winBtnStyle}
          title="Minimize"
        >
          <Minus size={16} strokeWidth={2} />
        </button>
        
        {/* Maximize/Restore - Windows Style */}
        <button 
          onClick={handleMaximize}
          className="win-btn maximize"
          style={winBtnStyle}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Square size={12} strokeWidth={2} /> : <Square size={14} strokeWidth={2} />}
        </button>
        
        {/* Close - Windows Style (Red on hover) */}
        <button 
          onClick={handleClose}
          className="win-btn close"
          style={{
            ...winBtnStyle,
            width: '46px',
          }}
          title="Close"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// Windows-style button styles
const winBtnStyle = {
  width: '46px',
  height: '40px',
  background: 'transparent',
  border: 'none',
  color: '#b9bbbe',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
};

// Windows-style hover effects CSS
const style = document.createElement('style');
style.textContent = `
  .titlebar {
    -webkit-app-region: drag;
  }
  .titlebar .win-btn {
    -webkit-app-region: no-drag;
  }
  .titlebar .win-btn:hover {
    background: #ffffff15 !important;
    color: #fff !important;
  }
  .titlebar .win-btn:active {
    background: #ffffff25 !important;
  }
  .titlebar .win-btn.close:hover {
    background: #e81123 !important;
    color: #fff !important;
  }
  .titlebar .win-btn.close:active {
    background: #f1707a !important;
  }
  /* Add padding to root when TitleBar is present */
  body.electron-app {
    padding-top: 40px !important;
  }
  body.electron-app #root {
    height: calc(100vh - 40px) !important;
  }
`;
document.head.appendChild(style);

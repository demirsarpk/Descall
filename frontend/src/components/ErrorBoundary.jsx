import React from "react";
import { t } from "../i18n/runtime";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "", stack: "", componentStack: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || t("Unexpected runtime error"),
      stack: error?.stack || "",
    };
  }

  componentDidCatch(error, errorInfo) {
    // Get detailed information
    const userData = this.getUserData();
    const category = this.categorizeError(error);
    const systemInfo = this.getSystemInfo();
    const connectionInfo = this.getConnectionInfo();

    this.setState({
      hasError: true,
      error: error,
      errorInfo: errorInfo,
      message: error?.message || t("An unexpected error occurred."),
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      userData,
      category,
      systemInfo,
      connectionInfo,
    });

    console.error("[Descall] Error Boundary Caught:", {
      error,
      errorInfo,
      userData,
      category,
      systemInfo,
      connectionInfo,
    });

    // Log error to backend
    this.logErrorToBackend(error, errorInfo);
  }

  logErrorToBackend = async (error, errorInfo) => {
    // Prevent recursive error logging
    if (this.isLoggingError) {
      console.warn("[Descall] Already logging an error, skipping to prevent loop");
      return;
    }
    
    this.isLoggingError = true;
    
    try {
      // Get detailed user information
      const userData = this.getUserData();
      
      // Categorize error
      const category = this.categorizeError(error);
      
      // Get system information
      const systemInfo = this.getSystemInfo();
      
      const errorData = {
        // Error details
        message: error?.message || "Unknown error",
        name: error?.name || "Error",
        stack: error?.stack || "",
        componentStack: errorInfo?.componentStack || "",
        
        // Categorization
        category: category.type,
        severity: category.severity,
        
        // User details
        userId: userData.id,
        username: userData.username,
        userEmail: userData.email,
        userRole: userData.role,
        sessionId: userData.sessionId,
        
        // System details
        url: systemInfo.url,
        referrer: systemInfo.referrer,
        userAgent: systemInfo.userAgent,
        platform: systemInfo.platform,
        language: systemInfo.language,
        screenResolution: systemInfo.screenResolution,
        viewport: systemInfo.viewport,
        timezone: systemInfo.timezone,
        
        // Timestamp
        timestamp: new Date().toISOString(),
        clientTimestamp: Date.now(),
        
        // Additional context
        isOnline: navigator.onLine,
        connection: this.getConnectionInfo(),
      };

      const API_URL = import.meta.env.VITE_API_URL || window.location.origin;
      const response = await fetch(`${API_URL}/api/errors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(errorData),
      });

      if (!response.ok) {
        console.error("[Descall] Failed to log error:", response.status);
      } else {
        console.log("[Descall] Error logged successfully");
      }
    } catch (err) {
      console.error("[Descall] Failed to log error to backend:", err);
    }
  };

  getUserData = () => {
    try {
      const stored = localStorage.getItem("descall_user");
      if (!stored || stored === "null" || stored === "undefined") {
        return {
          id: "anonymous",
          username: "Anonymous User",
          email: null,
          role: "guest",
          sessionId: null,
        };
      }
      const user = JSON.parse(stored);
      return {
        id: user?.id || "anonymous",
        username: user?.username || "Anonymous User",
        email: user?.email || null,
        role: user?.role || "guest",
        sessionId: user?.sessionId || null,
      };
    } catch (e) {
      console.error("[ErrorBoundary] Failed to parse user data:", e);
      return {
        id: "anonymous",
        username: "Anonymous User",
        email: null,
        role: "guest",
        sessionId: null,
      };
    }
  };

  categorizeError = (error) => {
    const message = (error?.message || "").toLowerCase();
    const stack = (error?.stack || "").toLowerCase();
    const name = (error?.name || "").toLowerCase();
    
    // Activity is not defined - specific fix
    if (message.includes("activity") || message.includes("is not defined") || message.includes("cannot read")) {
      return { type: "REFERENCE_ERROR", severity: "high" };
    }
    
    if (name.includes("referenceerror") || message.includes("undefined") || message.includes("null")) {
      return { type: "RUNTIME_ERROR", severity: "high" };
    }
    if (name.includes("syntaxerror") || message.includes("syntax") || message.includes("unexpected token")) {
      return { type: "SYNTAX_ERROR", severity: "critical" };
    }
    if (message.includes("network") || message.includes("fetch") || message.includes("xhr") || message.includes("timeout")) {
      return { type: "NETWORK_ERROR", severity: "medium" };
    }
    if (message.includes("permission") || message.includes("denied") || message.includes("unauthorized") || message.includes("forbidden")) {
      return { type: "AUTH_ERROR", severity: "medium" };
    }
    if (stack.includes("react") || stack.includes("component") || name.includes("react")) {
      return { type: "UI_ERROR", severity: "high" };
    }
    if (message.includes("webrtc") || message.includes("rtc") || message.includes("media") || stack.includes("webrtc")) {
      return { type: "WEBRTC_ERROR", severity: "high" };
    }
    if (name.includes("typeerror") || message.includes("type")) {
      return { type: "TYPE_ERROR", severity: "medium" };
    }
    if (message.includes("memory") || message.includes("heap") || message.includes("out of memory")) {
      return { type: "MEMORY_ERROR", severity: "critical" };
    }
    
    return { type: "UNKNOWN_ERROR", severity: "medium" };
  };

  getSystemInfo = () => {
    return {
      url: window.location.href,
      referrer: document.referrer || "direct",
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  };

  getConnectionInfo = () => {
    const conn = navigator.connection;
    if (conn) {
      return {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData,
      };
    }
    return null;
  };

  handleReset = () => {
    try {
      window.localStorage.removeItem("descall_user");
      window.localStorage.removeItem("descall_token");
    } catch {
      // Ignore storage reset failures.
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, errorInfo, userData, category, systemInfo, connectionInfo } = this.state;

    return (
      <main className="auth-shell">
        <section className="auth-card" style={{ maxWidth: "700px", maxHeight: "85vh", overflow: "auto" }}>
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <h1 style={{ color: "#ff6b6b", fontSize: "24px", marginBottom: "10px" }}>
              ⚠️ {t("Descall Error")}
            </h1>
            <p style={{ color: "#ccc", fontSize: "14px" }}>
              {t("UI crashed and recovered safely.")}
            </p>
          </div>

          {/* Error Type & Category */}
          <div style={{ 
            background: "#2a2a2a", 
            padding: "15px", 
            borderRadius: "8px",
            marginBottom: "15px"
          }}>
            <h3 style={{ color: "#fff", marginBottom: "10px", fontSize: "16px" }}>
              {t("Error Details")}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px" }}>
              <div>
                <span style={{ color: "#888" }}>{t("Type:")}</span>
                <span style={{ color: "#ff6b6b", marginLeft: "8px", fontWeight: "bold" }}>
                  {error?.name || t("Unknown Error")}
                </span>
              </div>
              {category?.type && (
                <div>
                  <span style={{ color: "#888" }}>{t("Category:")}</span>
                  <span style={{ color: "#4ecdc4", marginLeft: "8px" }}>
                    {category.type}
                  </span>
                </div>
              )}
              {category?.severity && (
                <div>
                  <span style={{ color: "#888" }}>{t("Severity:")}</span>
                  <span style={{ 
                    color: category.severity === 'critical' ? '#ff0000' : 
                           category.severity === 'high' ? '#ff6b6b' : 
                           category.severity === 'medium' ? '#ffa500' : '#4ecdc4',
                    marginLeft: "8px",
                    fontWeight: "bold"
                  }}>
                    {category.severity.toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <span style={{ color: "#888" }}>{t("Timestamp:")}</span>
                <span style={{ color: "#fff", marginLeft: "8px" }}>
                  {new Date().toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          <div style={{ 
            background: "#1a1a1a", 
            padding: "15px", 
            borderRadius: "8px",
            borderLeft: "4px solid #ff6b6b",
            marginBottom: "15px"
          }}>
            <h4 style={{ color: "#ff6b6b", marginBottom: "8px", fontSize: "14px" }}>
              {t("Error Message")}
            </h4>
            <p style={{ color: "#fff", fontSize: "14px", wordBreak: "break-word" }}>
              {this.state.message}
            </p>
          </div>

          {/* User Information */}
          {userData && (
            <div style={{ 
              background: "#2a2a2a", 
              padding: "15px", 
              borderRadius: "8px",
              marginBottom: "15px"
            }}>
              <h3 style={{ color: "#fff", marginBottom: "10px", fontSize: "16px" }}>
                👤 {t("User Information")}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px" }}>
                <div>
                  <span style={{ color: "#888" }}>{t("Username:")}</span>
                  <span style={{ color: "#fff", marginLeft: "8px" }}>
                    {userData.username || t("Anonymous")}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#888" }}>{t("User ID:")}</span>
                  <span style={{ color: "#fff", marginLeft: "8px" }}>
                    {userData.id || "anonymous"}
                  </span>
                </div>
                {userData.email && (
                  <div>
                    <span style={{ color: "#888" }}>{t("Email:")}</span>
                    <span style={{ color: "#fff", marginLeft: "8px" }}>
                      {userData.email}
                    </span>
                  </div>
                )}
                {userData.role && (
                  <div>
                    <span style={{ color: "#888" }}>{t("Role:")}</span>
                    <span style={{ color: "#4ecdc4", marginLeft: "8px" }}>
                      {userData.role}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* System Information */}
          {systemInfo && (
            <div style={{ 
              background: "#2a2a2a", 
              padding: "15px", 
              borderRadius: "8px",
              marginBottom: "15px"
            }}>
              <h3 style={{ color: "#fff", marginBottom: "10px", fontSize: "16px" }}>
                💻 {t("System Information")}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px" }}>
                <div>
                  <span style={{ color: "#888" }}>{t("Platform:")}</span>
                  <span style={{ color: "#fff", marginLeft: "8px" }}>
                    {systemInfo.platform}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#888" }}>{t("Language:")}</span>
                  <span style={{ color: "#fff", marginLeft: "8px" }}>
                    {systemInfo.language}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#888" }}>{t("Screen:")}</span>
                  <span style={{ color: "#fff", marginLeft: "8px" }}>
                    {systemInfo.screenResolution}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#888" }}>{t("Timezone:")}</span>
                  <span style={{ color: "#fff", marginLeft: "8px" }}>
                    {systemInfo.timezone}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: "8px", fontSize: "12px" }}>
                <span style={{ color: "#888" }}>{t("User Agent:")}</span>
                <span style={{ color: "#aaa", marginLeft: "8px", wordBreak: "break-all" }}>
                  {systemInfo.userAgent}
                </span>
              </div>
            </div>
          )}
          
          {/* Error Stack */}
          {this.state.stack && (
            <div style={{ marginBottom: "15px" }}>
              <h3 style={{ color: "#fff", marginBottom: "8px", fontSize: "14px" }}>
                📋 {t("Error Stack:")}
              </h3>
              <pre style={{ 
                background: "#1a1a1a", 
                color: "#ff6b6b", 
                padding: "12px", 
                borderRadius: "6px", 
                fontSize: "11px",
                overflow: "auto",
                maxHeight: "150px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}>
                {this.state.stack}
              </pre>
            </div>
          )}

          {/* Component Stack */}
          {this.state.componentStack && (
            <div style={{ marginBottom: "15px" }}>
              <h3 style={{ color: "#fff", marginBottom: "8px", fontSize: "14px" }}>
                🧩 {t("Component Stack:")}
              </h3>
              <pre style={{ 
                background: "#1a1a1a", 
                color: "#4ecdc4", 
                padding: "12px", 
                borderRadius: "6px", 
                fontSize: "11px",
                overflow: "auto",
                maxHeight: "120px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}>
                {this.state.componentStack}
              </pre>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button 
              type="button" 
              onClick={this.handleReset}
              style={{ 
                flex: 1,
                padding: "12px 20px",
                background: "#4ecdc4",
                color: "#1a1a1a",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold"
              }}
            >
              🔄 {t("Reset & Reload")}
            </button>
            <button 
              type="button"
              onClick={() => window.location.href = '/'}
              style={{ 
                flex: 1,
                padding: "12px 20px",
                background: "#444",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              🏠 {t("Go Home")}
            </button>
          </div>
          
          <p style={{ 
            marginTop: "15px", 
            fontSize: "11px", 
            color: "#666", 
            textAlign: "center" 
          }}>
            {t("This error has been logged. Please contact support if it persists.")}
          </p>
        </section>
      </main>
    );
  }
}

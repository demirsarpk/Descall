import { motion } from "framer-motion";
import { 
  X, Settings, Mic, Headphones, 
  Bell, User, LogOut, Moon, Sun
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";

/**
 * COMPLETELY REBUILT USER PANEL
 * Discord-style right sidebar for user settings
 * No old layout remnants
 */
export default function UserPanel({ me, onClose }) {
  return (
    <motion.aside
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="user-panel"
    >
      {/* Header */}
      <div className="user-panel-header">
        <h2 className="panel-title">User Settings</h2>
        <button 
          className="icon-btn"
          onClick={onClose}
          title="Close"
        >
          <X size={20} />
        </button>
      </div>

      {/* User Profile Card */}
      <div className="user-profile-card">
        <div className="profile-banner" />
        <div className="profile-avatar-large">
          <Avatar 
            name={me?.username || "User"} 
            size={80}
            imageUrl={me?.avatarUrl}
          />
          <div className="status-indicator">
            <StatusBadge status="online" />
          </div>
        </div>
        <div className="profile-info">
          <h3 className="profile-username">{me?.username || "User"}</h3>
          <span className="profile-discriminator">#{me?.discriminator || "0000"}</span>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="user-settings-sections">
        {/* Account Settings */}
        <div className="settings-section">
          <h4 className="section-heading">Account Settings</h4>
          <button className="settings-item">
            <div className="item-icon">
              <User size={20} />
            </div>
            <div className="item-content">
              <span className="item-label">My Account</span>
              <span className="item-desc">Edit your profile</span>
            </div>
            <ChevronRight size={16} className="item-chevron" />
          </button>
          <button className="settings-item">
            <div className="item-icon">
              <User size={20} />
            </div>
            <div className="item-content">
              <span className="item-label">User Profile</span>
              <span className="item-desc">Customize your profile</span>
            </div>
            <ChevronRight size={16} className="item-chevron" />
          </button>
        </div>

        {/* App Settings */}
        <div className="settings-section">
          <h4 className="section-heading">App Settings</h4>
          <button className="settings-item">
            <div className="item-icon">
              <Settings size={20} />
            </div>
            <div className="item-content">
              <span className="item-label">Appearance</span>
              <span className="item-desc">Theme, colors, density</span>
            </div>
            <ChevronRight size={16} className="item-chevron" />
          </button>
          <button className="settings-item">
            <div className="item-icon">
              <Bell size={20} />
            </div>
            <div className="item-content">
              <span className="item-label">Notifications</span>
              <span className="item-desc">Message & call alerts</span>
            </div>
            <ChevronRight size={16} className="item-chevron" />
          </button>
          <button className="settings-item">
            <div className="item-icon">
              <Mic size={20} />
            </div>
            <div className="item-content">
              <span className="item-label">Voice & Video</span>
              <span className="item-desc">Input, output, devices</span>
            </div>
            <ChevronRight size={16} className="item-chevron" />
          </button>
          <button className="settings-item">
            <div className="item-icon">
              <Headphones size={20} />
            </div>
            <div className="item-content">
              <span className="item-label">Sound Effects</span>
              <span className="item-desc">Volume, sounds</span>
            </div>
            <ChevronRight size={16} className="item-chevron" />
          </button>
        </div>

        {/* Logout */}
        <div className="settings-section danger">
          <button className="settings-item danger">
            <div className="item-icon">
              <LogOut size={20} />
            </div>
            <div className="item-content">
              <span className="item-label">Log Out</span>
              <span className="item-desc">Sign out of your account</span>
            </div>
          </button>
        </div>
      </div>
    </motion.aside>
  );
}

import { ChevronRight } from "lucide-react";

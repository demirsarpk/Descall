import { motion } from "framer-motion";
import {
  MessageSquare, Users, Settings, Bell,
  LogOut, User, Search, Plus, Mic, Phone, Shield
} from "lucide-react";
import { Avatar } from "../ui/Avatar";

export default function NavigationRail({
  activeView,
  onViewChange,
  onAdminClick,
  onUserClick,
  onAddClick,
  onVoiceClick,
  me,
  isAdmin
}) {
  const navItems = [
    { id: "chat", icon: MessageSquare, label: "Chats" },
    { id: "groups", icon: Users, label: "Groups" },
    { id: "calls", icon: Phone, label: "Calls" },
  ];

  return (
    <nav className="nav-rail">
      {/* Logo/Brand */}
      <div className="nav-rail-brand">
        <div className="brand-icon">D</div>
      </div>

      {/* Main Navigation */}
      <div className="nav-rail-main">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <motion.button
              key={item.id}
              className={`rail-btn ${isActive ? "active" : ""}`}
              onClick={() => onViewChange(item.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={item.label}
            >
              <Icon size={24} strokeWidth={2} />
            </motion.button>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="nav-rail-bottom">
        <motion.button
          className="rail-btn"
          onClick={onAddClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Add New"
        >
          <Plus size={24} strokeWidth={2} />
        </motion.button>

        <motion.button
          className="rail-btn"
          onClick={onVoiceClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Voice Chat"
        >
          <Mic size={24} strokeWidth={2} />
        </motion.button>

        <motion.button
          className="rail-btn"
          onClick={onUserClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="User Settings"
        >
          <Avatar
            name={me?.username || "User"}
            size={32}
            imageUrl={me?.avatarUrl}
          />
        </motion.button>

        {isAdmin && (
          <motion.button
            className="rail-btn admin-btn"
            onClick={onAdminClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Admin Panel"
          >
            <Shield size={24} strokeWidth={2} />
          </motion.button>
        )}
      </div>
    </nav>
  );
}

import React, { useMemo, useState } from "react";
import { FiBell, FiChevronDown, FiSearch } from "react-icons/fi";

function Navbar({
  searchQuery,
  onSearchChange,
  currentUser,
  notifications,
  unreadCount = 0,
  onNotificationsOpen,
  onLogout,
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const displayName = currentUser?.email || "User";
  const initials = useMemo(() => displayName.trim().charAt(0).toUpperCase(), [displayName]);

  return (
    <header className="top-navbar card">
      <div className="search-box">
        <FiSearch size={16} />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search candidates, roles, skills..."
        />
      </div>
      <div className="navbar-actions">
        <div className="navbar-menu-wrap">
        <button
          className="icon-button"
          type="button"
          aria-label="Notifications"
          onClick={() => {
            setShowNotifications((prev) => {
              const next = !prev;
              if (next && onNotificationsOpen) {
                onNotificationsOpen();
              }
              return next;
            });
            setShowProfileMenu(false);
          }}
        >
          <FiBell size={18} />
          {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
        </button>
        {showNotifications && (
          <div className="menu-dropdown notif-dropdown">
            <h4>Notifications</h4>
            {notifications.length ? (
              notifications.map((item) => (
                <p key={item.id} className="notification-item">
                  <strong>{item.message}</strong>
                  <span className="muted">{new Date(item.created_at).toLocaleString()}</span>
                </p>
              ))
            ) : (
              <p className="muted">No notifications</p>
            )}
          </div>
        )}
        </div>
        <div className="navbar-menu-wrap">
        <button
          className="profile-dropdown"
          type="button"
          onClick={() => {
            setShowProfileMenu((prev) => !prev);
            setShowNotifications(false);
          }}
        >
          <span className="avatar">{initials}</span>
          <span>{displayName}</span>
          <FiChevronDown size={15} />
        </button>
        {showProfileMenu && (
          <div className="menu-dropdown profile-menu-dropdown">
            <button type="button" className="menu-item-btn" disabled>
              Profile (coming soon)
            </button>
            <button type="button" className="menu-item-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;

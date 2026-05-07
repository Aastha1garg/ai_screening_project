import React, { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FiBell, FiChevronDown, FiSearch } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { formatDateOnly } from "../utils/dateFormatter";
import { formatErrorForDisplay } from "../utils/errorHandler";
import { useLanguageSettings } from "../context/LanguageContext";

function Navbar({
  searchQuery,
  onSearchChange,
  currentUser,
  notifications,
  unreadCount = 0,
  onNotificationsOpen,
  onLogout,
  onNavigateToProfile,
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const { t } = useTranslation();
  const { languageSettings } = useLanguageSettings();
  const notificationsRef = useRef(null);
  const notificationButtonRef = useRef(null);
  const dropdownRef = useRef(null);
  const profileRef = useRef(null);
  const displayName = currentUser?.email || "User";
  const initials = useMemo(() => displayName.trim().charAt(0).toUpperCase(), [displayName]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInsideNotifications =
        notificationsRef.current?.contains(event.target) ||
        dropdownRef.current?.contains(event.target);

      if (!clickedInsideNotifications) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!showNotifications || !notificationButtonRef.current) {
      return;
    }

    const rect = notificationButtonRef.current.getBoundingClientRect();
    const dropdownWidth = Math.min(320, window.innerWidth * 0.8);
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - dropdownWidth - 12);
    }

    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left,
      minWidth: 280,
      width: dropdownWidth,
      zIndex: 9999,
    });
  }, [showNotifications]);

  return (
    <header className="top-navbar card">
      <div className="search-box">
        <FiSearch size={16} />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("navbar.searchPlaceholder")}
        />
      </div>
      <div className="navbar-actions">
        <div className="navbar-menu-wrap" ref={notificationsRef}>
        <button
          className="icon-button"
          type="button"
          aria-label="Notifications"
          ref={notificationButtonRef}
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
        </div>
        {showNotifications &&
          createPortal(
            <div className="menu-dropdown notif-dropdown" style={dropdownStyle} ref={dropdownRef}>
              <h4>{t("navbar.notifications")}</h4>
              {notifications.length ? (
                notifications.map((item) => (
                  <p key={item.id} className="notification-item">
                    <strong>{typeof item.message === 'string' ? item.message : formatErrorForDisplay(item.message, 'Notification')}</strong>
                    <span className="muted">{formatDateOnly(item.created_at, languageSettings)}</span>
                  </p>
                ))
              ) : (
                <p className="muted">{t("navbar.noNotifications")}</p>
              )}
            </div>,
            document.body
          )}
        <div className="navbar-menu-wrap" ref={profileRef}>
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
          <div 
            className="menu-dropdown profile-menu-dropdown"
            style={{ position: "absolute", zIndex: 99999 }}
          >
            <button
              type="button"
              className="menu-item-btn"
              onClick={() => {
                setShowProfileMenu(false);
                if (onNavigateToProfile) {
                  onNavigateToProfile();
                }
              }}
            >
              {t("navbar.profile")}
            </button>
            <button type="button" className="menu-item-btn" onClick={onLogout}>
              {t("navbar.logout")}
            </button>
          </div>
        )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;

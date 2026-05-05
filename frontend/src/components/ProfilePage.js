import React, { useState, useEffect } from "react";
import { FiCheck, FiX } from "react-icons/fi";

const USER_PROFILE_KEY = "user_profile";

// Email validation regex
const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

function ProfilePage({ currentUser, onUserUpdate }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    dob: "",
  });
  const [originalData, setOriginalData] = useState({
    name: "",
    email: "",
    dob: "",
  });
  const [errors, setErrors] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [isModified, setIsModified] = useState(false);

  // Load user profile from localStorage on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem(USER_PROFILE_KEY);
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        setFormData(profile);
        setOriginalData(profile);
      } catch (err) {
        console.error("Error loading profile:", err);
      }
    } else if (currentUser?.email) {
      // Initialize with email if available
      const initialData = {
        name: "",
        email: currentUser.email || "",
        dob: "",
      };
      setFormData(initialData);
      setOriginalData(initialData);
    }
  }, [currentUser]);

  const handleInputChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    setIsModified(JSON.stringify(updated) !== JSON.stringify(originalData));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (formData.dob && !/^\d{4}-\d{2}-\d{2}$/.test(formData.dob)) {
      newErrors.dob = "Invalid date format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(formData));
    setOriginalData(formData);
    setIsModified(false);
    setShowSuccess(true);

    // Notify parent component of changes
    if (onUserUpdate) {
      onUserUpdate(formData);
    }

    // Hide success message after 3 seconds
    setTimeout(() => {
      setShowSuccess(false);
    }, 3000);
  };

  const handleCancel = () => {
    setFormData(originalData);
    setIsModified(false);
    setErrors({});
  };

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
  };

  const avatarInitials = getInitials(formData.name || currentUser?.email);

  return (
    <div className="profile-page-wrapper">
      <div className="profile-card">
        <h2>Profile Settings</h2>

        {/* Avatar Section */}
        <div className="profile-avatar-section">
          <div className="profile-avatar">
            {avatarInitials.toUpperCase()}
          </div>
          <div className="avatar-info">
            <p className="avatar-label">Your Profile</p>
            <p className="avatar-subtitle">Update your personal information</p>
          </div>
        </div>

        {/* Form Section */}
        <form className="profile-form">
          {/* Name Field */}
          <div className="form-group">
            <label htmlFor="name">Full Name *</label>
            <input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className={errors.name ? "error" : ""}
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          {/* Email Field */}
          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              className={errors.email ? "error" : ""}
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          {/* Date of Birth Field */}
          <div className="form-group">
            <label htmlFor="dob">Date of Birth</label>
            <input
              id="dob"
              type="date"
              value={formData.dob}
              onChange={(e) => handleInputChange("dob", e.target.value)}
              className={errors.dob ? "error" : ""}
            />
            {errors.dob && <span className="error-message">{errors.dob}</span>}
          </div>
        </form>

        {/* Success Message */}
        {showSuccess && (
          <div className="success-message">
            <FiCheck size={18} />
            <span>Profile saved successfully!</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="profile-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={!isModified}
          >
            <FiCheck size={16} />
            Save Changes
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCancel}
            disabled={!isModified}
          >
            <FiX size={16} />
            Cancel
          </button>
        </div>

        {/* Info Text */}
        <p className="profile-info-text">
          Your profile information helps us personalize your experience. Changes are saved locally on your device.
        </p>
      </div>
    </div>
  );
}

export default ProfilePage;

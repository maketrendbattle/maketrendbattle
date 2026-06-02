/**
 * Rocky Axis Authentication Gateway - Frontend Client Controller
 * * Purpose: Manages client-side transitions, input formats, image rendering,
 * and interacts with the decoupled Backend over Native HTTP Fetch API streams.
 */

import { API_CONFIG } from "../config/apiConfig.js";

const $ = (id) => document.getElementById(id);
let registrationEnabled = true;

// Active Firebase Auth client reference
let clientAuthInstance = null;

// Configure synchronization parameters
const setRegistrationStatus = (status) => {
  registrationEnabled = status;
};

// ==========================================================================
// SYSTEM ALERTS & SCREEN LOAD OVERLAYS
// ==========================================================================
const notify = (msg, type = 'info') => {
  const n = $('notification');
  if (!n) return;
  n.innerHTML = msg;
  n.className = `notification show ${type}`;
  clearTimeout(n._t);
  n._t = setTimeout(() => n.classList.remove('show'), 4000);
};

const showLoader = (s) => {
  const loader = $('globalLoader');
  if (loader) loader.classList.toggle('show', s);
};

const clearErrors = () => {
  document.querySelectorAll('.error-msg').forEach(e => e.classList.remove('show'));
};

const showError = (id, msg) => {
  const el = $(id + 'Error');
  if (el) {
    el.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
    el.classList.add('show');
  }
};

const togglePass = (id, icon) => {
  const inp = $(id);
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.className = 'fas fa-eye-slash toggle-password';
  } else {
    inp.type = 'password';
    icon.className = 'fas fa-eye toggle-password';
  }
};

const switchTab = (tab) => {
  if (tab === 'register' && !registrationEnabled) {
    notify('Registration is currently disabled.', 'warning');
    return;
  }

  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  ['loginForm', 'registerForm', 'forgotForm', 'completeProfileForm'].forEach(id => {
    const el = $(id);
    if (el) el.classList.remove('active');
  });

  if (tab === 'login' && $('loginForm')) $('loginForm').classList.add('active');
  else if (tab === 'register' && $('registerForm')) $('registerForm').classList.add('active');
  else if (tab === 'forgot' && $('forgotForm')) $('forgotForm').classList.add('active');
  else if (tab === 'complete' && $('completeProfileForm')) $('completeProfileForm').classList.add('active');
};

function toggleLoginInputs() {
  const isPhone = $('loginType').value === 'phone';
  $('loginEmailWrapper').style.display = isPhone ? 'none' : 'block';
  $('loginPhoneWrapper').style.display = isPhone ? 'block' : 'none';
  clearErrors();
}

const validateUsernameInput = (inp) => {
  let val = inp.value.trim();
  val = val.replace(/@/g, '').replace(/[^a-z0-9]/g, '').toLowerCase();
  inp.value = val;
};

function handleAvatarUpload(input, previewId, hiddenInputId) {
  if (!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height, maxSize = 200;
      if (w > h) { if (w > maxSize) { h *= maxSize / w; w = maxSize; } }
      else { if (h > maxSize) { w *= maxSize / h; h = maxSize; } }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataURL = canvas.toDataURL('image/jpeg', 0.85);
      $(hiddenInputId).value = dataURL;
      $(previewId).innerHTML = `<img src="${dataURL}" alt="avatar">`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(input.files[0]);
}

const updateStrength = (pwd) => {
  const bar = $('strengthBar'), text = $('strengthText');
  if (!bar || !text) return;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const widths = [0, 25, 50, 75, 100], 
        colors = ['#e74c3c', '#e74c3c', '#f39c12', '#2ecc71', '#2ecc71'], 
        labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  bar.style.width = widths[score] + '%'; 
  bar.style.background = colors[score];
  text.textContent = pwd ? labels[score] : '';
};

const switchToLogin = (email) => { 
  switchTab('login'); 
  $('loginEmail').value = email; 
};

function applyEmailUIRules(email) {
  const emailInput = $('profileEmail');
  const lockIcon = $('profileEmailLock');
  const icon = $('profileEmailIcon');
  if (!emailInput) return;
  
  if (email && email.trim() !== '') {
    emailInput.value = email;
    emailInput.readOnly = true;
    emailInput.style.background = 'rgba(46, 204, 113, 0.08)';
    emailInput.style.color = 'var(--success)';
    emailInput.style.borderColor = 'var(--success)';
    emailInput.style.cursor = 'not-allowed';
    emailInput.style.fontWeight = '600';
    if (lockIcon) lockIcon.style.display = 'block';
    if (icon) icon.style.color = 'var(--success)';
  } else {
    emailInput.value = '';
    emailInput.readOnly = false;
    emailInput.style.background = 'var(--input-bg)';
    emailInput.style.color = '#fff';
    emailInput.style.borderColor = 'var(--input-border)';
    emailInput.style.cursor = 'text';
    emailInput.style.fontWeight = 'normal';
    if (lockIcon) lockIcon.style.display = 'none';
    if (icon) icon.style.color = 'var(--muted)';
  }
}

// ==========================================================================
// ASYNCHRONOUS API NETWORK COMMUNICATOR FLOWS
// ==========================================================================
let usernameTimer, profileTimer;
const triggerUsernameAvailabilityCheck = () => {
  const username = $('regUsername').value.trim().toLowerCase();
  const status = $('usernameStatus');
  if (username.length < 2) { status.className = 'username-status'; status.textContent = ''; return; }
  status.className = 'username-status checking'; status.textContent = '...';
  clearTimeout(usernameTimer);
  usernameTimer = setTimeout(async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VERIFY_USERNAME}?username=${username}`);
      const data = await res.json();
      if (data.available) { status.className = 'username-status available'; status.textContent = '✓ Available'; }
      else { status.className = 'username-status taken'; status.textContent = '✗ Taken'; }
    } catch (e) {
      status.className = 'username-status'; status.textContent = '';
    }
  }, 500);
};

const triggerProfileUsernameCheck = () => {
  const username = $('profileUsername').value.trim();
  const status = $('profileUsernameStatus');
  if (username.length < 2) { status.className = 'username-status'; status.textContent = ''; return; }
  status.className = 'username-status checking'; status.textContent = '...';
  clearTimeout(profileTimer);
  profileTimer = setTimeout(async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VERIFY_USERNAME}?username=${username}`);
      const data = await res.json();
      if (data.available) { status.className = 'username-status available'; status.textContent = '✓ Available'; }
      else { status.className = 'username-status taken'; status.textContent = '✗ Taken'; }
    } catch (e) {
      status.className = 'username-status'; status.textContent = '';
    }
  }, 500);
};

const triggerEmailAvailabilityCheck = async () => {
  const email = $('regEmail').value.trim();
  if (!email) return;
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VERIFY_EMAIL}?email=${email}`);
    const data = await res.json();
    if (!data.available) {
      $('regEmailError').innerHTML = `<i class="fas fa-exclamation-circle"></i> Already registered. <a id="alertToLoginBtn" style="color:var(--accent); cursor:pointer;">Login instead</a>`;
      $('regEmailError').classList.add('show');
      const alertBtn = $('alertToLoginBtn');
      if (alertBtn) alertBtn.addEventListener('click', () => switchToLogin(email));
    } else {
      $('regEmailError').classList.remove('show');
    }
  } catch (e) {}
};

const triggerPhoneAvailabilityCheck = async () => {
  const code = $('countryCode').value;
  const phone = $('phoneNumber').value.trim();
  if (!phone || phone.length !== 10) return;
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VERIFY_PHONE}?code=${code}&phone=${phone}`);
    const data = await res.json();
    if (!data.available) {
      $('phoneError').innerHTML = `<i class="fas fa-exclamation-circle"></i> Phone number already registered.`;
      $('phoneError').classList.add('show');
    } else {
      $('phoneError').classList.remove('show');
    }
  } catch (e) {}
};

// ==========================================================================
// ACTION TRIGGERS (FETCH POST OPERATIONS TO VERCEL BACKEND)
// ==========================================================================
const handleLoginSubmit = async () => {
  clearErrors();
  const method = $('loginType').value;
  const password = $('loginPassword').value;
  const rememberMe = $('rememberMe').checked;

  if (!password) { showError('loginPassword', 'Password required'); return; }
  
  let accountId = '';
  if (method === 'phone') {
    const code = $('loginCountryCode').value;
    const num = $('loginPhoneNumber').value.trim();
    if (!num || num.length !== 10) { showError('loginPhone', '10-digit phone required'); return; }
    accountId = code + num;
  } else {
    accountId = $('loginEmail').value.trim();
    if (!accountId) { showError('loginEmail', 'Email required'); return; }
  }

  showLoader(true);
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, accountId, password, rememberMe })
    });
    const result = await res.json();
    if (result.success) {
      notify('Welcome back!', 'success');
      setTimeout(() => { window.location.href = result.redirectUrl; }, 600);
    } else {
      showLoader(false);
      if (result.errorType === 'phone-not-found') showError('loginPhone', 'Phone number not found');
      else if (result.errorType === 'wrong-password') showError('loginPassword', 'Incorrect password');
      else showError('loginEmail', result.message || 'Sign in failed. Check inputs.');
    }
  } catch (e) {
    showLoader(false);
    notify('Unable to contact authentication server.', 'error');
  }
};

const handleRegisterSubmit = async () => {
  if (!registrationEnabled) {
    notify('Registration is currently disabled.', 'error');
    return;
  }
  clearErrors();
  const username = $('regUsername').value.trim().toLowerCase();
  const password = $('regPassword').value;
  const confirm = $('regConfirmPassword').value;
  const code = $('countryCode').value;
  const phone = $('phoneNumber').value.trim();
  const email = $('regEmail').value.trim();
  const avatar = $('avatarDataURL').value || '';
  const refCode = $('regReferralCode').value.trim().toUpperCase();

  let valid = true;
  if (!username || username.length < 2) { showError('regUsername', 'Enter a valid username (min 2 chars)'); valid = false; }
  if (!password) { showError('regPassword', 'Password is required'); valid = false; }
  else if (password.length < 6) { showError('regPassword', 'Minimum 6 characters'); valid = false; }
  if (password !== confirm) { showError('regConfirmPassword', 'Passwords do not match'); valid = false; }
  
  if (!email && !phone) {
    showError('regEmail', 'Email or phone required');
    showError('phone', 'Phone or email required');
    valid = false;
  } else if (phone && phone.length !== 10) {
    showError('phone', '10-digit number required');
    valid = false;
  }

  if (!valid) return;

  showLoader(true);
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REGISTER}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email, code, phone, avatar, refCode })
    });
    const result = await res.json();
    if (result.success) {
      notify('Account created! +10 NPR bonus added.', 'success');
      setTimeout(() => { window.location.href = result.redirectUrl; }, 600);
    } else {
      showLoader(false);
      notify(result.message || 'Registration failed. Try again.', 'error');
    }
  } catch (e) {
    showLoader(false);
    notify('Registration network connection offline.', 'error');
  }
};

const handlePasswordResetSubmit = async () => {
  const email = $('resetEmail').value.trim();
  if (!email) { notify('Please enter your email address.', 'error'); return; }
  showLoader(true);
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.FORGOT_PASSWORD}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const result = await res.json();
    showLoader(false);
    if (result.success) {
      notify('Reset link sent! Check your inbox.', 'success');
      switchTab('login');
    } else {
      notify(result.message, 'error');
    }
  } catch (e) {
    showLoader(false);
    notify('Reset connection failed.', 'error');
  }
};

const handleSaveProfileSubmit = async () => {
  const email = $('profileEmail').value.trim();
  const username = $('profileUsername').value.trim().toLowerCase();
  const country = $('profileCountryCode').value;
  const phone = $('profilePhone').value.trim();
  const avatar = $('avatarDataURL2').value || '';
  const refCode = $('profileReferralCode').value.trim().toUpperCase();
  const password = $('profilePassword').value;

  if (!email) { notify('Email address is required.', 'error'); return; }
  if (!username || username.length < 2) { notify('Username required.', 'error'); return; }
  if (!password || password.length < 6) { notify('Set account password (min 6 characters).', 'error'); return; }

  showLoader(true);
  try {
    const user = clientAuthInstance.currentUser;
    const uid = user ? user.uid : '';

    const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SAVE_SOCIAL_PROFILE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, email, username, country, phone, avatar, refCode, password })
    });
    const result = await res.json();
    if (result.success) {
      notify('Profile saved successfully!', 'success');
      setTimeout(() => { window.location.href = result.redirectUrl; }, 1000);
    } else {
      showLoader(false);
      notify(result.message || 'Error saving profile.', 'error');
    }
  } catch (e) {
    showLoader(false);
    notify('Profile synchronization lost.', 'error');
  }
};

// ==========================================================================
// SECURE SOCIAL POPUP OAUTH FLOW (Client-Side Token Extraction)
// ==========================================================================
const triggerSocialLoginFlow = async (providerName) => {
  if (!clientAuthInstance) return;
  showLoader(true);

  const provider = providerName === 'google' 
    ? new window.firebase.auth.GoogleAuthProvider() 
    : new window.firebase.auth.FacebookAuthProvider();

  if (providerName === 'google') {
    provider.addScope('email');
    provider.addScope('profile');
  } else if (providerName === 'facebook') {
    provider.addScope('email');
    provider.addScope('public_profile');
  }

  try {
    const result = await clientAuthInstance.signInWithPopup(provider);
    const user = result.user;

    // Send payload to Vercel backend to complete security indexing
    const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SOCIAL_AUTH_FLOW}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        providerId: result.additionalUserInfo?.providerId
      })
    });
    
    const backendResult = await res.json();
    if (backendResult.success) {
      if (backendResult.status === 'logged-in') {
        notify('Login successful!', 'success');
        setTimeout(() => { window.location.href = backendResult.redirectUrl; }, 600);
      } else if (backendResult.status === 'complete-profile') {
        applyEmailUIRules(backendResult.email);
        const profileUserInp = $('profileUsername');
        if (profileUserInp) profileUserInp.value = backendResult.suggestedUsername;

        const avatarPreview2 = $('avatarPreview2');
        const avatarDataURL2 = $('avatarDataURL2');

        if (backendResult.photoURL) {
          if (avatarPreview2) avatarPreview2.innerHTML = `<img src="${backendResult.photoURL}" alt="avatar">`;
          if (avatarDataURL2) avatarDataURL2.value = backendResult.photoURL;
        } else {
          if (avatarPreview2) avatarPreview2.innerHTML = backendResult.displayNameInitial || 'U';
          if (avatarDataURL2) avatarDataURL2.value = '';
        }
        switchTab('complete');
        showLoader(false);
        notify('Please finalize your profile details.', 'info');
      }
    } else {
      showLoader(false);
      if (backendResult.errorType === 'account-exists') {
        notify('An email matching this user exists. Use standard login.', 'warning');
        switchToLogin(backendResult.email);
      } else {
        notify(backendResult.message || 'Social validation handshake failed.', 'error');
      }
    }
  } catch (err) {
    showLoader(false);
    if (err.code === 'auth/account-exists-with-different-credential') {
      notify('Email already registered with another provider! Directing you back to login.', 'warning');
      const loginEmailInp = $('loginEmail');
      if (loginEmailInp) loginEmailInp.value = err.customData.email || '';
      switchTab('login');
    } else {
      notify('Social handshake failed.', 'error');
    }
  }
};

// ==========================================================================
// DYNAMIC EVENT LISTENERS REGISTRATION
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  // Navigation hooks
  if ($('loginTabBtn')) $('loginTabBtn').addEventListener('click', () => switchTab('login'));
  if ($('registerTabBtn')) $('registerTabBtn').addEventListener('click', () => switchTab('register'));
  if ($('linkToRegister')) $('linkToRegister').addEventListener('click', () => switchTab('register'));
  if ($('linkToLogin')) $('linkToLogin').addEventListener('click', () => switchTab('login'));
  if ($('linkToForgot')) $('linkToForgot').addEventListener('click', () => switchTab('forgot'));
  if ($('linkBackToLogin')) $('linkBackToLogin').addEventListener('click', () => switchTab('login'));

  if ($('loginType')) $('loginType').addEventListener('change', toggleLoginInputs);

  // Form hooks
  if ($('loginBtn')) $('loginBtn').addEventListener('click', handleLoginSubmit);
  if ($('regBtn')) $('regBtn').addEventListener('click', handleRegisterSubmit);
  if ($('resetPasswordBtn')) $('resetPasswordBtn').addEventListener('click', handlePasswordResetSubmit);
  if ($('saveProfileBtn')) $('saveProfileBtn').addEventListener('click', handleSaveProfileSubmit);

  if ($('googleLoginBtn')) $('googleLoginBtn').addEventListener('click', () => triggerSocialLoginFlow('google'));
  if ($('facebookLoginBtn')) $('facebookLoginBtn').addEventListener('click', () => triggerSocialLoginFlow('facebook'));

  if ($('toggleLoginPass')) $('toggleLoginPass').addEventListener('click', function() { togglePass('loginPassword', this); });
  if ($('toggleRegPass')) $('toggleRegPass').addEventListener('click', function() { togglePass('regPassword', this); });
  if ($('toggleRegConfirmPass')) $('toggleRegConfirmPass').addEventListener('click', function() { togglePass('regConfirmPassword', this); });
  if ($('toggleProfilePass')) $('toggleProfilePass').addEventListener('click', function() { togglePass('profilePassword', this); });

  // Input hooks
  if ($('regUsername')) $('regUsername').addEventListener('input', function() { validateUsernameInput(this); triggerUsernameAvailabilityCheck(); });
  if ($('profileUsername')) $('profileUsername').addEventListener('input', function() { validateUsernameInput(this); triggerProfileUsernameCheck(); });
  if ($('regEmail')) $('regEmail').addEventListener('blur', triggerEmailAvailabilityCheck);
  if ($('phoneNumber')) $('phoneNumber').addEventListener('input', function() { this.value = this.value.replace(/\D/g, ''); triggerPhoneAvailabilityCheck(); });
  if ($('profilePhone')) $('profilePhone').addEventListener('input', function() { this.value = this.value.replace(/\D/g, ''); });
  if ($('loginPhoneNumber')) $('loginPhoneNumber').addEventListener('input', function() { this.value = this.value.replace(/\D/g, ''); });
  if ($('regPassword')) $('regPassword').addEventListener('input', function() { updateStrength(this.value); });

  if ($('avatarFile')) $('avatarFile').addEventListener('change', function() { handleAvatarUpload(this, 'avatarPreview', 'avatarDataURL'); });
  if ($('avatarFile2')) $('avatarFile2').addEventListener('change', function() { handleAvatarUpload(this, 'avatarPreview2', 'avatarDataURL2'); });

  // Initialize client Firebase sandbox for OAuth popups
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyCsW8Yy1UKIRX6Sm6SoQr1aZowF8OMFO2g",
      authDomain: "maketrendbattle-rockyaxis.firebaseapp.com",
      projectId: "maketrendbattle-rockyaxis"
    };
    window.firebase.initializeApp(firebaseConfig);
    clientAuthInstance = window.firebase.auth();
  } catch (err) {
    console.error("Local sandbox initialization blocked: ", err);
  }

  // Load backend registration configurations dynamically
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REG_CONFIG}`);
    const config = await res.json();
    setRegistrationStatus(config.enabled);
    
    const registerTab = $('registerTabBtn');
    const regBtn = $('regBtn');
    const closedNotice = $('registrationClosedNotice');

    if (!config.enabled) {
      if (registerTab) {
        registerTab.disabled = true;
        registerTab.style.opacity = '0.5';
        registerTab.style.cursor = 'not-allowed';
      }
      if (regBtn) regBtn.disabled = true;
      if (closedNotice) closedNotice.style.display = 'block';
    }

    if (config.referralCode) {
      const regReferralInput = $('regReferralCode');
      const profileReferralInput = $('profileReferralCode');
      if (regReferralInput) regReferralInput.value = config.referralCode;
      if (profileReferralInput) profileReferralInput.value = config.referralCode;
    }
  } catch (err) {
    console.warn("Express API registration configuration offline.");
  }
});
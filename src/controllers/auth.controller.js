const authService = require("../services/auth.service");

async function register(req, res) {
  try {
    const { name, mobile, password } = req.body;
    await authService.register({ name, mobile, password });
    res.status(201).json({ message: "Registration Successful" });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || "Server Error" });
  }
}

async function login(req, res) {
  try {
    const { mobile, password } = req.body;
    const { token, username, userId, role } = await authService.login({ mobile, password });

    res.cookie("authToken", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 1000,
      path: "/",
    });

    res.json({ message: "Login Successful", token, username, userId, role });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || "Login Error" });
  }
}

function logout(req, res) {
  res.clearCookie("authToken", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  res.json({ message: "Logout successful" });
}

function profile(req, res) {
  res.json({
    message: "Protected Profile Data",
    user: req.user,
  });
}

function session(req, res) {
  const profile = req.userProfile || {};
  const role = String(req.user?.role || profile.role || "user").trim().toLowerCase() === "admin"
    ? "admin"
    : "user";

  res.json({
    authenticated: true,
    user: {
      id: req.user?.id || profile.id || null,
      username: profile.full_name || "",
      mobile: profile.mobile || "",
      role,
    },
    serverTime: new Date().toISOString(),
  });
}

async function listUsers(req, res) {
  try {
    const users = await authService.getUsersForAdmin();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || "Server Error" });
  }
}

async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const updatedUser = await authService.updateUserRole({
      targetUserId: id,
      newRole: role,
      actorUserId: req.user?.id,
    });

    res.json({
      message: updatedUser.changed ? "User role updated" : "User role already up to date",
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || "Server Error" });
  }
}

module.exports = {
  register,
  login,
  logout,
  profile,
  session,
  listUsers,
  updateUserRole,
};

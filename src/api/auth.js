import axios from "./axios";

export const loginUser = async (email, password) => {
  try {
    const res = await axios.post("/auth/login", {
      email: email.trim(),
      password
    });

    return res.data;
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Server error. Try again."
    };
  }
};
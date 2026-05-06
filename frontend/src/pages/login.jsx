import React, { useState } from "react";
import { ToastContainer } from "react-toastify";
import { handleError, handleSuccess } from "../utils";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar"; // <--- Import Navbar

export default function Login() {
  const [loginInfo, setLoginInfo] = useState({
    email: "",
    password: "",
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLoginInfo((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const { email, password } = loginInfo;
    if (!email || !password) {
      return handleError("Please fill all details");
    }
    try {
      const url = "http://localhost:8080/auth/login";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginInfo),
      });
      const result = await response.json();
      const { success, message, jwtToken, name } = result;
      if (success) {
        handleSuccess(message);
        localStorage.setItem("token", jwtToken);
        localStorage.setItem("loggedinuser", name);
        setTimeout(() => {
          navigate("/home");
        }, 1000);
      } else {
        handleError(message || "Login failed");
      }
    } catch (err) {
      handleError(err.message || "Server error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-12">
      <Navbar />

      <div className="w-full max-w-md">
        <div className="section-band mb-6">
          <p className="text-xs uppercase tracking-[0.32em] text-blue-200 font-semibold">Secure access</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold text-white">Login</h1>
          <p className="mt-3 text-sm text-slate-200">Enter your credentials to access portfolio insights and performance signals.</p>
        </div>

        <div className="unique-panel p-8">
          <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
            <input
              type="email"
              name="email"
              placeholder="your.email@example.com"
              value={loginInfo.email}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-slate-800 placeholder-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              value={loginInfo.password}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-slate-800 placeholder-slate-400"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 shadow-lg shadow-blue-200"
          >
            Sign In
          </button>

          <div className="pt-4 text-center text-sm text-slate-600">
            Don't have an account?{" "}
            <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-semibold underline">
              Create one
            </Link>
          </div>
        </form>        </div>
        <ToastContainer />
      </div>
    </div>
  );
}
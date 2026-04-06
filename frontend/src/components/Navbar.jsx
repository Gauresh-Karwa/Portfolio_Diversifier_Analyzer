import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom"; // Added useLocation
import { handleSuccess } from "../utils";

export default function Navbar() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation(); // Hook to get the current URL path

  useEffect(() => {
    setLoggedInUser(localStorage.getItem("loggedinuser"));
  }, []);

  const handleLogout = (e) => {
    localStorage.removeItem("token");
    localStorage.removeItem("loggedinuser");
    handleSuccess("User Logged out");
    setLoggedInUser(null);
    setTimeout(() => {
      navigate("/login");
    }, 1000);
  };

  // Check if the current page is Login or Signup
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  return (
    <nav className="fixed w-full z-50 top-0 start-0 border-b border-white/10 bg-gray-900/50 backdrop-blur-md">
      <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
        
        {/* Logo Section - Always Visible */}
        <Link to="/" className="flex items-center space-x-3 rtl:space-x-reverse">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
             <span className="text-white font-bold text-xl">A</span>
          </div>
          <span className="self-center text-2xl font-bold whitespace-nowrap text-white tracking-wide">
            Auric
          </span>
        </Link>

        {/* Buttons Section */}
        <div className="flex md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse gap-4">
          {loggedInUser ? (
            // If user is logged in, show Logout button
            <div className="flex items-center gap-4">
              <span className="text-gray-300 hidden md:block text-sm font-medium">
                Hello, {loggedInUser}
              </span>
              <button
                onClick={handleLogout}
                className="text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-900 font-medium rounded-lg text-sm px-4 py-2 text-center transition-all shadow-md"
              >
                Logout
              </button>
            </div>
          ) : (
            // If user is NOT logged in...
            // Only show these buttons if NOT on Login or Signup page
            !isAuthPage && (
              <div className="flex gap-3">
                <Link to="/login">
                  <button className="text-gray-300 hover:text-white font-medium rounded-lg text-sm px-4 py-2 text-center transition-colors">
                    Login
                  </button>
                </Link>
                
                <Link to="/signup">
                  <button className="text-gray-300 hover:text-white font-medium rounded-lg text-sm px-4 py-2 text-center transition-colors">
                    Signup
                  </button>
                </Link>
              </div>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
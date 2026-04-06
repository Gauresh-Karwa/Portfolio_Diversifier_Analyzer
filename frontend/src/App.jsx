import { useState, useEffect } from 'react'
import './App.css';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/login';
import Signup from './pages/signup';
import Home from './pages/home';
import LandingPage from './pages/LandingPage';
import RefreshHandler from './refreshhandler';


function App() {
  const [isAuthenticated,setIsAuthenticated]=useState(true); 

  useEffect(() => {
    // Mock user for bypass
    if (!localStorage.getItem('loggedinuser')) {
      localStorage.setItem('loggedinuser', 'Admin User');
      localStorage.setItem('token', 'fake-token-123');
    }
  }, []);

  const PrivateRoute=({element})=>{
    return element; // Always allowed for testing
  }

  return (
    <>
    <RefreshHandler setIsAuthenticated={setIsAuthenticated}/>
    <Routes>
      <Route path='/' element={<Navigate to="/welcome"/>}></Route>
      <Route path="/welcome" element={<LandingPage />} />
      <Route path='/login' element={<Login/>}></Route>
      <Route path='/signup' element={<Signup/>}></Route>
      <Route path='/home' element={<PrivateRoute element={<Home/>}/>}></Route>
    </Routes>
    </>
  )
}

export default App

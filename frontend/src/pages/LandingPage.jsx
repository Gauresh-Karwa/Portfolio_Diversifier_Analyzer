import React, { useState } from "react";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaChartLine, FaRobot, FaUniversity, FaCheckCircle, FaPlus, FaMinus } from "react-icons/fa";
import { BsLightningChargeFill } from "react-icons/bs";

// --- Components ---

// 1. Hero Section
const HeroSection = ({ navigate }) => {
  return (
    <div className="relative isolate px-6 pt-32 lg:px-8 pb-20 overflow-hidden">

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60rem] h-[60rem] bg-blue-600/20 rounded-full blur-[120px] -z-10" />
      
      <div className="mx-auto max-w-5xl text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <span className="bg-gray-800/50 border border-gray-700 text-blue-300 text-sm font-medium px-4 py-1.5 rounded-full backdrop-blur-sm">
            The Ultimate Portfolio Tracker
          </span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-5xl md:text-7xl font-black tracking-tight text-white mb-6"
        >
          NOT JUST ANOTHER <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            FINANCE TRACKER
          </span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-6 text-xl text-gray-400 max-w-2xl mx-auto"
        >
          The ultimate AI-powered investment companion powered by advanced diversification algorithms.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-10"
        >
          <button
            onClick={() => navigate('/signup')}
            className="bg-yellow-400 text-black font-extrabold text-lg px-10 py-4 rounded-full hover:bg-yellow-300 hover:scale-105 transition-all shadow-[0_0_30px_rgba(250,204,21,0.4)]"
          >
            JOIN NOW
          </button>
        </motion.div>
      </div>
    </div>
  );
};


// Floating Cards
const FloatingCard = ({ icon, label, top, left, right, bottom, delay }) => (
  <motion.div 
    animate={{ y: [0, -15, 0] }}
    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay }}
    className="absolute bg-gray-800/80 backdrop-blur-md border border-gray-700 p-4 rounded-xl flex items-center gap-3 shadow-xl z-20"
    style={{ top, left, right, bottom }}
  >
    <span className="text-2xl">{icon}</span>
    <span className="text-white font-bold">{label}</span>
  </motion.div>
);


// 2. Features Section
const FeaturesBento = () => {
  return (
    <div className="py-24 px-6 mx-auto max-w-7xl">
      <h2 className="text-4xl md:text-5xl font-bold text-center text-white mb-16">
        What you'll unlock inside <span className="text-blue-500">Auric</span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-6 h-auto md:h-[800px]">

        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="col-span-1 md:col-span-2 row-span-1 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-8 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-100 transition-opacity">
            <FaChartLine className="text-9xl text-blue-500" />
          </div>

          <h3 className="text-3xl font-bold text-white mb-4">
            Advanced Portfolio Analysis
          </h3>

          <ul className="space-y-3 text-gray-300 text-lg">
            <li className="flex items-center gap-2">
              <FaCheckCircle className="text-blue-500" /> Real-time Diversification Checks
            </li>

            <li className="flex items-center gap-2">
              <FaCheckCircle className="text-blue-500" /> Risk Exposure Heatmaps
            </li>

            <li className="flex items-center gap-2">
              <FaCheckCircle className="text-blue-500" /> Asset Allocation Tracking
            </li>
          </ul>

          <button className="mt-8 bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold">
            Try it now
          </button>
        </motion.div>


        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="col-span-1 row-span-1 md:row-span-2 bg-black border border-gray-800 rounded-3xl p-8 flex flex-col justify-between"
        >
          <div>
            <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase mb-4 inline-block">
              New
            </span>

            <h3 className="text-3xl font-bold text-white mb-2">
              AI Recommendation Engine
            </h3>

            <p className="text-gray-400">
              Personalized investment advice based on your goals and risk profile.
            </p>
          </div>

          <div className="mt-8 flex justify-center">
            <FaRobot className="text-8xl text-purple-500 animate-bounce" />
          </div>
        </motion.div>


        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-gray-900 border border-gray-700 rounded-3xl p-8"
        >
          <BsLightningChargeFill className="text-4xl text-yellow-400 mb-4" />

          <h3 className="text-2xl font-bold text-white mb-2">
            Instant CSV Import
          </h3>

          <p className="text-gray-400">
            Upload bulk portfolio data in seconds.
          </p>
        </motion.div>


        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-gray-900 border border-gray-700 rounded-3xl p-8"
        >
          <FaUniversity className="text-4xl text-green-400 mb-4" />

          <h3 className="text-2xl font-bold text-white mb-2">
            Financial Freedom
          </h3>

          <p className="text-gray-400">
            Learn how to balance debt and equity for long-term growth.
          </p>
        </motion.div>

      </div>
    </div>
  );
};


// 3. How It Works Section
const HowItWorksSection = () => {

  const steps = [
    {
      title: "Upload Portfolio",
      desc: "Import your broker CSV or manually add your investments."
    },
    {
      title: "AI Portfolio Analysis",
      desc: "Auric analyzes diversification, sector exposure, and risk."
    },
    {
      title: "Get Smart Insights",
      desc: "Receive recommendations to optimize your portfolio."
    }
  ];

  return (
    <div className="py-24 bg-black">

      <h2 className="text-5xl font-bold text-center text-white mb-16">
        How Auric Works
      </h2>

      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-10">

        {steps.map((step, i) => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center hover:scale-105 transition-transform"
          >
            <div className="text-5xl font-black text-blue-500 mb-6">
              {i + 1}
            </div>

            <h3 className="text-2xl font-bold text-white mb-4">
              {step.title}
            </h3>

            <p className="text-gray-400">
              {step.desc}
            </p>
          </div>
        ))}

      </div>
    </div>
  );
};


// FAQ
const FAQSection = () => {

  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    { q: "Is my financial data safe?", a: "Yes" },
    { q: "Do I need to manually enter trades?", a: "No. Upload your broker CSV." },
    { q: "Can I Trust Your Analysis", a: "Yes,We Only Provide Financial Advice do Cross Check" }
  ];

  return (
    <div className="py-20 max-w-3xl mx-auto px-6">

      <h2 className="text-4xl font-bold text-center text-white mb-12">
        Got Questions?
      </h2>

      <div className="space-y-4">

        {faqs.map((faq, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg">

            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex justify-between items-center p-6 text-left"
            >
              <span className="text-lg font-semibold text-white">
                {faq.q}
              </span>

              {openIndex === i ? <FaMinus /> : <FaPlus />}
            </button>

            <AnimatePresence>

              {openIndex === i && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 pt-0 text-gray-400 border-t border-gray-800">
                    {faq.a}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

          </div>
        ))}

      </div>
    </div>
  );
};


// --- Main Landing Page ---

export default function LandingPage() {

  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden">

      <Navbar />

      <HeroSection navigate={navigate} />

      <div className="bg-yellow-400 py-4 rotate-1 scale-105 overflow-hidden border-y-4 border-black">

        <motion.div
          animate={{ x: ["0%", "-100%"] }}
          transition={{ repeat: Infinity, ease: "linear", duration: 10 }}
          className="flex whitespace-nowrap gap-12 text-black font-black text-2xl uppercase"
        >
          {[...Array(10)].map((_, i) => (
            <span key={i}>
              TRACK STOCKS  MUTUAL FUNDS  GOLD  REAL ESTATE
            </span>
          ))}
        </motion.div>

      </div>

      <FeaturesBento />

      <HowItWorksSection />

      <FAQSection />

      <div className="py-24 text-center bg-gradient-to-t from-blue-900/40 to-black border-t border-gray-800">

        <h2 className="text-5xl md:text-6xl font-black text-white mb-8">
          STOP DELAYING YOUR WEALTH GROWTH.
        </h2>

        <button
          onClick={() => navigate('/signup')}
          className="bg-white text-black font-extrabold text-xl px-12 py-5 rounded-full hover:scale-105 transition-transform"
        >
          START TODAY
        </button>

      </div>

      <footer className="bg-black py-8 text-center text-gray-600 text-sm">
        © 2026 Auric Financial Systems. All rights reserved.
      </footer>

    </div>
  );
}
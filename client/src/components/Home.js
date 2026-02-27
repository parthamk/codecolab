import React, { useState } from "react";
import { v4 as uuid } from "uuid";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const faqs = [
  {
    q: "🚀 How do I create a new room?",
    a: 'Click "New Room" to auto-generate a unique Room ID, then enter your username and click JOIN. Share the Room ID with collaborators.',
  },
  {
    q: "👥 How do I invite collaborators?",
    a: "Share your Room ID with teammates. They enter the same ID and their own username to join your live session instantly.",
  },
  {
    q: "💻 Which languages are supported?",
    a: "JavaScript (Node.js), Python, C, C++, Java, and Rust — all with auto-loaded Hello World boilerplate and language-aware error hints.",
  },
  {
    q: "⚡ How does live collaboration work?",
    a: "All keystrokes sync in real time via WebSocket. Members appear as avatar icons on the left sidebar with hover tooltips showing their names.",
  },
  {
    q: "▶️ How do I run code?",
    a: 'Select your language from the dropdown, write or edit code, then hit "Run Code". Output and error hints appear in the bottom console panel.',
  },
];

function Home() {
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [openFaq, setOpenFaq] = useState(null);
  const navigate = useNavigate();

  const generateRoomId = (e) => {
    e.preventDefault();
    setRoomId(uuid());
    toast.success("Room ID generated!");
  };

  const joinRoom = () => {
    if (!roomId || !username) {
      toast.error("Both fields are required");
      return;
    }
    navigate(`/editor/${roomId}`, { state: { username } });
    toast.success("Room joined!");
  };

  const handleInputEnter = (e) => {
    if (e.code === "Enter") joinRoom();
  };

  return (
    <div className="home-page">
      <div className="home-grid-bg" />
      <div className="home-orb home-orb--1" />
      <div className="home-orb home-orb--2" />

      <div className="home-container">
        {/* Hero */}
        <div className="home-hero">
          <div className="home-badge">REAL-TIME CODE COLLABORATION</div>
          <h1 className="home-title">
            Code<span className="home-title-accent">Colab</span>
          </h1>
          <p className="home-subtitle">
            Write, run, and collaborate on code in real time — no setup required.
          </p>
        </div>

        {/* Join card */}
        <div className="home-card">
          <div className="home-card-glow" />
          <h2 className="home-card-title">Join a Room</h2>

          <div className="home-input-group">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="home-input"
              placeholder="ROOM ID"
              onKeyUp={handleInputEnter}
            />
          </div>

          <div className="home-input-group">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="home-input"
              placeholder="USERNAME"
              onKeyUp={handleInputEnter}
            />
          </div>

          <button className="home-join-btn" onClick={joinRoom}>
            JOIN ROOM
          </button>

          <p className="home-new-room-text">
            No room ID?{" "}
            <span className="home-new-room-link" onClick={generateRoomId}>
              Generate New Room
            </span>
          </p>
        </div>

        {/* How to use */}
        <div className="home-faq-section">
          <h3 className="home-faq-title">How to Use</h3>
          {faqs.map((item, i) => (
            <div key={i} className="home-faq-item">
              <button
                className={`home-faq-btn${openFaq === i ? " home-faq-btn--open" : ""}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{item.q}</span>
                <span className={`home-faq-arrow${openFaq === i ? " home-faq-arrow--open" : ""}`}>
                  ▾
                </span>
              </button>
              {openFaq === i && (
                <div className="home-faq-answer">{item.a}</div>
              )}
            </div>
          ))}
        </div>

        <p className="home-footer">© 2025 CodeColab · Built for real-time devs</p>
      </div>
    </div>
  );
}

export default Home;

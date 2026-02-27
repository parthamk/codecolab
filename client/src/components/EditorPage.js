import React, { useEffect, useRef, useState } from "react";
import Client from "./Client";
import Editor from "./Editor";
import { initSocket } from "../Socket";
import { ACTIONS } from "../Actions";
import {
  useNavigate,
  useLocation,
  Navigate,
  useParams,
} from "react-router-dom";
import { toast } from "react-hot-toast";

function EditorPage() {
  const [clients, setClients] = useState([]);
  const [output, setOutput] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [language, setLanguage] = useState("nodejs-20.17.0");
  const [showServerWarning, setShowServerWarning] = useState(true);
  
  const codeRef = useRef(null);

  const Location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();

  const socketRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      const handleErrors = (err) => {
        console.log("Error", err);
        toast.error("Socket connection failed, Try again later");
        navigate("/");
      };

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: Location.state?.username,
      });

      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username, socketId }) => {
          if (username !== Location.state?.username) {
            toast.success(`${username} joined the room.`);
          }
          setClients(clients);
          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            code: codeRef.current,
            socketId,
          });
        }
      );

      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room`);
        setClients((prev) => {
          return prev.filter((client) => client.socketId !== socketId);
        });
      });
    };
    init();

    return () => {
      socketRef.current && socketRef.current.disconnect();
      socketRef.current.off(ACTIONS.JOINED);
      socketRef.current.off(ACTIONS.DISCONNECTED);
    };
  }, [Location.state?.username, navigate, roomId]);

  if (!Location.state) {
    return <Navigate to="/" />;
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID is copied");
    } catch (error) {
      console.log(error);
      toast.error("Unable to copy the room ID");
    }
  };

  const leaveRoom = async () => {
    navigate("/");
  };

  const downloadCode = () => {
    const codeContent = codeRef.current;
    if (!codeContent) return toast.error("No code to download");
    
    // Fallback simple extension since it supports multiple languages now
    const blob = new Blob([codeContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `script-${roomId}.txt`; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Code downloaded successfully!");
  };

  const runCode = async () => {
    const codeContent = codeRef.current;
    if (!codeContent) return toast.error("No code to run");

    setIsCompiling(true);
    setOutput("Executing code...\n");

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            code: codeContent,
            compiler: language // Sending the selected language to backend
        }),
      });
      
      const result = await response.json();
      
      if (result.status !== "0") {
        const errorOutput = result.program_error || result.compiler_error || result.message || "Unknown Error";
        const placeholderSuggestion = "Check your syntax for missing brackets or undefined variables. Ensure your code is valid for the selected language.";
        setOutput(`Error:\n${errorOutput}\n\n💡 Fix Suggestion:\n${placeholderSuggestion}`);
      } else {
        setOutput(result.program_message || "Execution finished with no output.");
      }
    } catch (err) {
      console.error("Frontend execution error:", err);
      setOutput("Failed to connect to execution server.");
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="container-fluid vh-100 position-relative">
      
      {/* Cookie-Style Server Issue Warning Popup */}
      {showServerWarning && (
        <div style={{
          position: "fixed",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#2c2e3a",
          color: "#fff",
          padding: "15px 30px",
          borderRadius: "50px", 
          boxShadow: "0px 4px 15px rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          gap: "20px",
          zIndex: 9999,
          border: "1px solid #444",
          width: "max-content",
          maxWidth: "90%"
        }}>
          <span style={{ fontSize: "14px", fontWeight: "500" }}>
            ⚠️ Website may face server issue. Please refresh the page and try again if that happens.
          </span>
          <button 
            className="btn btn-sm btn-light rounded-pill px-4" 
            onClick={() => setShowServerWarning(false)}
            style={{ fontWeight: "bold" }}
          >
            OK
          </button>
        </div>
      )}

      <div className="row h-100">
        {/* Sidebar panel */}
        <div
          className="col-md-2 bg-light text-dark d-flex flex-column h-100 p-3"
          style={{ boxShadow: "2px 0px 4px rgba(0, 0, 0, 0.1)" }}
        >
          <div className="d-flex flex-column flex-grow-1 overflow-auto">
            <h5 className="mb-3 border-bottom pb-2">Members</h5>
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>

          <hr />
          {/* Action Buttons */}
          <div className="mt-auto d-flex flex-column gap-2">
            <button className="btn btn-success" onClick={copyRoomId}>
              Copy Room ID
            </button>
            <button className="btn btn-primary" onClick={downloadCode}>
              Download Code
            </button>
            <button className="btn btn-danger" onClick={leaveRoom}>
              Leave Room
            </button>
          </div>
        </div>

        {/* Editor & Console panel */}
        <div className="col-md-10 d-flex flex-column h-100 p-0">
          
          {/* Top Bar for Running Code & Language Selection */}
          <div className="d-flex justify-content-end align-items-center p-2 bg-secondary border-bottom">
            {/* Language Dropdown */}
            <select 
              className="form-select w-auto me-3 fw-bold bg-dark text-white border-secondary" 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              style={{ cursor: "pointer" }}
            >
              <option value="nodejs-20.17.0">JavaScript (Node.js)</option>
              <option value="cpython-3.12.0">Python</option>
              <option value="gcc-13.2.0-c">C</option>
              <option value="gcc-13.2.0">C++ (GCC)</option>
              <option value="openjdk-jdk-21+35">Java</option>
              <option value="rust-1.82.0">Rust</option>
            </select>
            
            <button 
                className="btn btn-warning px-4 fw-bold" 
                onClick={runCode} 
                disabled={isCompiling}
            >
              {isCompiling ? "Running..." : "Run Code"}
            </button>
          </div>

          {/* Main Code Editor */}
          <div className="flex-grow-1 overflow-auto" style={{ height: "70%" }}>
            <Editor
              socketRef={socketRef}
              roomId={roomId}
              username={Location.state?.username}
              onCodeChange={(code) => {
                codeRef.current = code;
              }}
            />
          </div>

          {/* Output Terminal */}
          <div className="bg-dark text-white p-3" style={{ height: "30%", borderTop: "2px solid #555", overflowY: "auto" }}>
            <h6 className="text-secondary mb-2">Output Console</h6>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "14px" }}>
              {output || "Run code to see output..."}
            </pre>
          </div>

        </div>
      </div>
    </div>
  );
}

export default EditorPage;
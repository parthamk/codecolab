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
    
    const blob = new Blob([codeContent], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `script-${roomId}.js`;
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
      // Send code to YOUR backend, not directly to Piston
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeContent }),
      });
      
      const result = await response.json();
      
      // Safety check: Prevent app crash if API is down or returns an error
      if (!response.ok || !result.run) {
        setOutput(`Execution Error: ${result.message || "Unable to run code at this time."}`);
        return;
      }

      // Check if the code itself produced an error during execution
      if (result.run.code !== 0) {
        const errorOutput = result.run.output;
        const placeholderSuggestion = "Make sure all variables are defined and syntax is correct based on the JSHint warnings in the editor.";
        setOutput(`Error:\n${errorOutput}\n\n💡 Fix Suggestion:\n${placeholderSuggestion}`);
      } else {
        setOutput(result.run.output || "Execution finished with no output.");
      }
    } catch (err) {
      console.error(err);
      setOutput("Failed to connect to execution server.");
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="container-fluid vh-100">
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
          
          {/* Top Bar for Running Code */}
          <div className="d-flex justify-content-end p-2 bg-secondary border-bottom">
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
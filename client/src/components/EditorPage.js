import React, { useEffect, useRef, useState } from "react";
import Client from "./Client";
import Editor from "./Editor";
import { initSocket } from "../Socket";
import { ACTIONS } from "../Actions";
import { useNavigate, useLocation, Navigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";

const boilerplates = {
  "nodejs-20.17.0": 'console.log("Hello from JavaScript!");',
  "cpython-3.12.0": 'print("Hello from Python!")',
  "gcc-13.2.0-c": '#include <stdio.h>\n\nint main() {\n    printf("Hello from C!\\n");\n    return 0;\n}',
  "gcc-13.2.0": '#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++!" << std::endl;\n    return 0;\n}',
  "openjdk-jdk-21+35": 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}',
  "rust-1.82.0": 'fn main() {\n    println!("Hello from Rust!");\n}',
};

function EditorPage() {
  const [clients, setClients] = useState([]);
  const [output, setOutput] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [language, setLanguage] = useState("nodejs-20.17.0");
  const [showServerWarning, setShowServerWarning] = useState(true);
  
  const codeRef = useRef(boilerplates["nodejs-20.17.0"]); // Initial default boilerplate
  const socketRef = useRef(null);
  const { roomId } = useParams();
  const Location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();
      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: Location.state?.username,
      });

      socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
        if (username !== Location.state?.username) {
          toast.success(`${username} joined.`);
        }
        setClients(clients);
        socketRef.current.emit(ACTIONS.SYNC_CODE, { code: codeRef.current, socketId });
      });

      socketRef.current.on(ACTIONS.DISCONNECTED, ({ username, socketId }) => {
        toast.success(`${username} left.`);
        setClients((prev) => prev.filter((c) => c.socketId !== socketId));
      });
    };
    init();
    return () => socketRef.current?.disconnect();
  }, [roomId, Location.state?.username]);

  // Handle language change and update boilerplate
  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    const currentCode = codeRef.current;

    // Only overwrite with boilerplate if the editor is empty or contains another boilerplate
    const isDefaultCode = Object.values(boilerplates).some(b => b.trim() === currentCode.trim()) || currentCode.trim() === "";
    
    if (isDefaultCode) {
      const newBoilerplate = boilerplates[newLang];
      codeRef.current = newBoilerplate;
      // Emit the change so other users see the new boilerplate
      socketRef.current.emit(ACTIONS.CODE_CHANGE, { roomId, code: newBoilerplate });
      // Note: Editor component will pick this up via the socket listener
    }
    
    setLanguage(newLang);
  };

  const runCode = async () => {
    setIsCompiling(true);
    setOutput("Executing code...\n");

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeRef.current, compiler: language }),
      });
      
      const result = await response.json();
      
      if (result.status !== "0") {
        const errorOutput = result.program_error || result.compiler_error || result.message || "Unknown Error";
        
        // --- Improved Language-Specific Suggestions ---
        let suggestion = "Check for missing semicolons, brackets, or undefined variables.";
        if (language.includes("python") && errorOutput.includes("IndentationError")) {
          suggestion = "Fix the indentation of your blocks. Python relies on consistent spacing.";
        } else if (language.includes("gcc") && errorOutput.includes("main")) {
          suggestion = "Ensure you have a valid 'int main()' function defined.";
        } else if (language.includes("openjdk") && !codeRef.current.includes("public class Main")) {
          suggestion = "In this environment, your class must be named 'Main'.";
        }

        setOutput(`Error:\n${errorOutput}\n\n💡 Fix Suggestion:\n${suggestion}`);
      } else {
        setOutput(result.program_message || "Execution finished with no output.");
      }
    } catch (err) {
      setOutput("Failed to connect to execution server.");
    } finally {
      setIsCompiling(false);
    }
  };

  if (!Location.state) return <Navigate to="/" />;

  return (
    <div className="container-fluid vh-100 position-relative">
      {showServerWarning && (
        <div className="fixed-bottom mb-4 mx-auto text-center" style={{ zIndex: 9999 }}>
            <div className="bg-dark text-white p-3 rounded-pill d-inline-block shadow border border-secondary" style={{ maxWidth: "90%" }}>
                <span className="me-3">⚠️ Website may face server issues. Refresh and try again if it disconnects.</span>
                <button className="btn btn-sm btn-light rounded-pill px-4 fw-bold" onClick={() => setShowServerWarning(false)}>OK</button>
            </div>
        </div>
      )}

      <div className="row h-100">
        <div className="col-md-2 bg-light d-flex flex-column h-100 p-3 shadow-sm">
          <div className="flex-grow-1 overflow-auto">
            <h5 className="mb-3 border-bottom pb-2">Members</h5>
            {clients.map((c) => <Client key={c.socketId} username={c.username} />)}
          </div>
          <div className="mt-auto d-flex flex-column gap-2">
            <button className="btn btn-success" onClick={() => {
                navigator.clipboard.writeText(roomId);
                toast.success("Room ID copied");
            }}>Copy Room ID</button>
            <button className="btn btn-primary" onClick={() => {
                 const blob = new Blob([codeRef.current], { type: "text/plain" });
                 const link = document.body.appendChild(document.createElement("a"));
                 link.href = URL.createObjectURL(blob);
                 link.download = `code-${roomId}.txt`;
                 link.click();
                 document.body.removeChild(link);
            }}>Download Code</button>
            <button className="btn btn-danger" onClick={() => navigate("/")}>Leave Room</button>
          </div>
        </div>

        <div className="col-md-10 d-flex flex-column h-100 p-0">
          <div className="d-flex justify-content-end align-items-center p-2 bg-secondary border-bottom">
            <select 
              className="form-select w-auto me-3 fw-bold bg-dark text-white border-secondary" 
              value={language} 
              onChange={handleLanguageChange}
            >
              <option value="nodejs-20.17.0">JavaScript (Node.js)</option>
              <option value="cpython-3.12.0">Python</option>
              <option value="gcc-13.2.0-c">C</option>
              <option value="gcc-13.2.0">C++ (GCC)</option>
              <option value="openjdk-jdk-21+35">Java</option>
              <option value="rust-1.82.0">Rust</option>
            </select>
            <button className="btn btn-warning px-4 fw-bold" onClick={runCode} disabled={isCompiling}>
              {isCompiling ? "Running..." : "Run Code"}
            </button>
          </div>

          <div className="flex-grow-1 overflow-auto" style={{ height: "70%" }}>
            <Editor
              socketRef={socketRef}
              roomId={roomId}
              username={Location.state?.username}
              language={language}
              onCodeChange={(code) => { codeRef.current = code; }}
            />
          </div>

          <div className="bg-dark text-white p-3" style={{ height: "30%", borderTop: "2px solid #555", overflowY: "auto" }}>
            <h6 className="text-secondary mb-2">Output Console</h6>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "14px" }}>
              {output || "Run code to see output..."}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditorPage;
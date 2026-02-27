import React, { useEffect, useRef, useState } from "react";
import Client from "./Client";
import Editor from "./Editor";
import { initSocket } from "../Socket";
import { ACTIONS } from "../Actions";
import { useNavigate, useLocation, Navigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";

const boilerplates = {
  "nodejs-20.17.0":   '// JavaScript (Node.js)\nconsole.log("Hello, World!");',
  "cpython-3.12.7":   '# Python\nprint("Hello, World!")',
  "gcc-13.2.0-c":     '// C\n#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
  "gcc-13.2.0":       '// C++\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
  "openjdk-jdk-21+35":'// Java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  "rust-1.82.0":      '// Rust\nfn main() {\n    println!("Hello, World!");\n}',
};

function getErrorHint(language, errorOutput, code) {
  const e = errorOutput || "";

  if (language.includes("nodejs")) {
    if (e.includes("SyntaxError"))        return "💡 JavaScript: Check for missing brackets, parentheses, or a stray comma.";
    if (e.includes("ReferenceError"))     return "💡 JavaScript: A variable is used before it's declared. Check spelling or add `let`/`const`.";
    if (e.includes("TypeError"))          return "💡 JavaScript: You may be calling a non-function or accessing a property of `null`/`undefined`.";
    if (e.includes("Cannot find module")) return "💡 JavaScript: A required module is missing. Make sure all imports are correct.";
    return "💡 JavaScript: Check for missing semicolons, mismatched brackets, or undefined variables.";
  }

  if (language.includes("python")) {
    if (e.includes("IndentationError"))   return "💡 Python: Fix indentation — Python relies on consistent spaces (not tabs mixed with spaces).";
    if (e.includes("SyntaxError"))        return "💡 Python: Check colons after `def`/`if`/`for`, unclosed quotes, or mismatched parentheses.";
    if (e.includes("NameError"))          return "💡 Python: A variable name isn't defined. Check for typos or missing imports.";
    if (e.includes("TypeError"))          return "💡 Python: Type mismatch. Ensure you're not mixing incompatible types (e.g. str + int).";
    if (e.includes("ImportError") || e.includes("ModuleNotFoundError"))
                                          return "💡 Python: Module not found. Confirm the module name and that it's available in this environment.";
    return "💡 Python: Review your code for indentation, syntax, or logic issues.";
  }

  if (language === "gcc-13.2.0-c") {
    if (e.includes("undeclared"))          return "💡 C: Variable used without declaration. Declare it before use (e.g. `int x;`).";
    if (e.includes("missing ';'") || e.includes("expected ';'"))
                                           return "💡 C: Missing semicolon at end of a statement.";
    if (e.includes("main"))                return "💡 C: Make sure you have `int main()` defined as the entry point.";
    if (e.includes("implicit declaration")) return "💡 C: Include the correct header file (e.g. `#include <stdio.h>`).";
    return "💡 C: Check for missing semicolons, undeclared variables, or missing `#include` headers.";
  }

  if (language === "gcc-13.2.0") {
    if (e.includes("was not declared"))    return "💡 C++: Variable or function not declared in this scope.";
    if (e.includes("no match for 'operator'")) return "💡 C++: Operator type mismatch. Ensure operand types are compatible.";
    if (e.includes("main"))                return "💡 C++: Ensure `int main()` exists as the entry point.";
    if (e.includes("linker"))              return "💡 C++: Linker error — a function is declared but not defined, or you're missing a library.";
    return "💡 C++: Check for undeclared variables, type mismatches, or missing `#include` statements.";
  }

  if (language.includes("openjdk")) {
    if (!code.includes("public class Main")) return "💡 Java: Your class must be named `Main` in this environment (`public class Main { ... }`).";
    if (e.includes("';' expected"))          return "💡 Java: Missing semicolon at the end of a statement.";
    if (e.includes("cannot find symbol"))    return "💡 Java: An identifier (variable/method) is not found. Check spelling and imports.";
    if (e.includes("reached end of file"))   return "💡 Java: Unexpected end of file — you may have unclosed `{` braces.";
    return "💡 Java: Check for missing semicolons, unmatched braces, or that your class is named `Main`.";
  }

  if (language.includes("rust")) {
    if (e.includes("expected"))          return "💡 Rust: Syntax error. Check semicolons, braces, and `fn` signatures.";
    if (e.includes("cannot find value")) return "💡 Rust: Variable not found. Make sure it's declared with `let`.";
    if (e.includes("borrow"))            return "💡 Rust: Borrow checker issue. Review ownership and borrowing rules.";
    if (e.includes("mismatched types"))  return "💡 Rust: Type mismatch. Ensure function return types and variable types align.";
    return "💡 Rust: Review ownership, semicolons, and function signatures.";
  }

  if (e.includes("Backend execution failed") || e.includes("Failed to connect")) {
    return "⚠️ Server Issue: The execution server may be overloaded or unavailable. Wait a moment and try again.";
  }

  return "💡 Check your syntax, logic, and that your code compiles for the selected language.";
}

function EditorPage() {
  const [clients, setClients]           = useState([]);
  const [output, setOutput]             = useState("");
  const [isCompiling, setIsCompiling]   = useState(false);
  const [language, setLanguage]         = useState("nodejs-20.17.0");
  const [showWarning, setShowWarning]   = useState(true);

  const codeRef   = useRef(boilerplates["nodejs-20.17.0"]);
  const socketRef = useRef(null);
  const { roomId }  = useParams();
  const Location    = useLocation();
  const navigate    = useNavigate();

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();
      socketRef.current.emit(ACTIONS.JOIN, { roomId, username: Location.state?.username });

      socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
        if (username !== Location.state?.username) toast.success(`${username} joined.`);
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

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    const isDefault =
      Object.values(boilerplates).some((b) => b.trim() === codeRef.current.trim()) ||
      codeRef.current.trim() === "";

    if (isDefault) {
      const bp = boilerplates[newLang];
      codeRef.current = bp;
      socketRef.current.emit(ACTIONS.CODE_CHANGE, { roomId, code: bp });
    }
    setLanguage(newLang);
    setOutput("");
  };

  const runCode = async () => {
    setIsCompiling(true);
    setOutput("⏳ Executing code...\n");
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeRef.current, compiler: language }),
      });
      const result = await response.json();
      if (result.status !== "0") {
        const err = result.program_error || result.compiler_error || result.message || "Unknown Error";
        setOutput(`❌ Error:\n${err}\n\n${getErrorHint(language, err, codeRef.current)}`);
      } else {
        setOutput(result.program_message || "✅ Execution finished with no output.");
      }
    } catch {
      setOutput(`❌ Failed to connect to execution server.\n\n${getErrorHint(language, "Failed to connect", codeRef.current)}`);
    } finally {
      setIsCompiling(false);
    }
  };

  const downloadCode = () => {
    const ext = { "nodejs-20.17.0": "js", "cpython-3.12.7": "py", "gcc-13.2.0-c": "c", "gcc-13.2.0": "cpp", "openjdk-jdk-21+35": "java", "rust-1.82.0": "rs" }[language] || "txt";
    const blob = new Blob([codeRef.current], { type: "text/plain" });
    const link = document.body.appendChild(document.createElement("a"));
    link.href = URL.createObjectURL(blob);
    link.download = `code-${roomId}.${ext}`;
    link.click();
    document.body.removeChild(link);
  };

  if (!Location.state) return <Navigate to="/" />;

  return (
    <div className="editor-page">
      {showWarning && (
        <div className="editor-warning-banner">
          <span>⚠️ Server may face occasional delays. Refresh if disconnected.</span>
          <button className="editor-warning-btn" onClick={() => setShowWarning(false)}>OK</button>
        </div>
      )}

      <div className="editor-layout">
        {/* Sidebar */}
        <div className="editor-sidebar">
          <span className="editor-sidebar-logo">⌨</span>
          <div className="editor-members-label">MEMBERS</div>
          <div className="editor-client-list">
            {clients.map((c) => <Client key={c.socketId} username={c.username} />)}
          </div>
          <div className="editor-sidebar-actions">
            <button
              className="editor-side-btn editor-side-btn--copy"
              onClick={() => { navigator.clipboard.writeText(roomId); toast.success("Room ID copied"); }}
            >
              📋 Copy ID
            </button>
            <button className="editor-side-btn editor-side-btn--download" onClick={downloadCode}>
              ⬇ Download
            </button>
            <button className="editor-side-btn editor-side-btn--leave" onClick={() => navigate("/")}>
              ✕ Leave
            </button>
          </div>
        </div>

        {/* Editor area */}
        <div className="editor-area">
          <div className="editor-toolbar">
            <select className="editor-lang-select" value={language} onChange={handleLanguageChange}>
              <option value="nodejs-20.17.0">JavaScript (Node.js)</option>
              <option value="cpython-3.12.7">Python</option>
              <option value="gcc-13.2.0-c">C</option>
              <option value="gcc-13.2.0">C++ (GCC)</option>
              <option value="openjdk-jdk-21+35">Java</option>
              <option value="rust-1.82.0">Rust</option>
            </select>
            <button className="editor-run-btn" onClick={runCode} disabled={isCompiling}>
              {isCompiling ? "⏳ Running..." : "▶ Run Code"}
            </button>
          </div>

          <div className="editor-cm-wrapper">
            <Editor
              socketRef={socketRef}
              roomId={roomId}
              username={Location.state?.username}
              language={language}
              onCodeChange={(code) => { codeRef.current = code; }}
            />
          </div>

          <div className="editor-console">
            <div className="editor-console-header">
              <span className="editor-console-label">OUTPUT CONSOLE</span>
              {output && (
                <button className="editor-console-clear" onClick={() => setOutput("")}>Clear</button>
              )}
            </div>
            <pre className="editor-console-pre">
              {output || "Run code to see output here..."}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditorPage;

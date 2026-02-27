import React, { useEffect, useRef } from "react";
import CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/dracula.css";

// Modes
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/python/python";
import "codemirror/mode/clike/clike"; // Handles C, C++, and Java
import "codemirror/mode/rust/rust";

// Addons
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import "codemirror/addon/hint/show-hint.css";
import "codemirror/addon/hint/show-hint";
import "codemirror/addon/hint/javascript-hint";
import "codemirror/addon/hint/anyword-hint";
import "codemirror/addon/lint/lint.css";
import "codemirror/addon/lint/lint";
import "codemirror/addon/lint/javascript-lint";

import { ACTIONS } from "../Actions";

const Editor = ({ socketRef, roomId, onCodeChange, username, language }) => {
  const editorRef = useRef(null);

  // Helper to map Wandbox compilers to CodeMirror modes
  const getMode = (lang) => {
    if (lang.includes("nodejs")) return "javascript";
    if (lang.includes("python")) return "python";
    if (lang.includes("gcc")) return "text/x-c++src";
    if (lang.includes("openjdk")) return "text/x-java";
    if (lang.includes("rust")) return "rust";
    return "javascript";
  };

  useEffect(() => {
    const initEditor = () => {
      editorRef.current = CodeMirror.fromTextArea(
        document.getElementById("realtimeEditor"),
        {
          mode: getMode(language),
          theme: "dracula",
          autoCloseTags: true,
          autoCloseBrackets: true,
          lineNumbers: true,
          extraKeys: { "Ctrl-Space": "autocomplete" },
          gutters: ["CodeMirror-lint-markers"],
          // Only enable linting for JavaScript since we have JSHint loaded
          lint: language.includes("nodejs"), 
        }
      );

      editorRef.current.setSize(null, "100%");
      editorRef.current.on("change", (instance, changes) => {
        const { origin } = changes;
        const code = instance.getValue();
        onCodeChange(code);
        if (origin !== "setValue") {
          socketRef.current.emit(ACTIONS.CODE_CHANGE, { roomId, code });
        }
      });
    };

    if (!editorRef.current) initEditor();
  }, []);

  // Update mode and linting dynamically when the dropdown changes
  useEffect(() => {
    if (editorRef.current) {
      const newMode = getMode(language);
      editorRef.current.setOption("mode", newMode);
      
      // Toggle JSHint based on whether the language is JavaScript
      editorRef.current.setOption("lint", language.includes("nodejs"));
    }
  }, [language]);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
        if (code !== null && editorRef.current.getValue() !== code) {
          editorRef.current.setValue(code);
        }
      });
    }
    return () => socketRef.current?.off(ACTIONS.CODE_CHANGE);
  }, [socketRef]);

  return (
    <div style={{ height: "100%" }}>
      <textarea id="realtimeEditor"></textarea>
    </div>
  );
};

export default Editor;
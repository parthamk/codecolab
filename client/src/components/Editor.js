import React, { useEffect, useRef } from "react";
import CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/dracula.css";

import "codemirror/mode/javascript/javascript";
import "codemirror/mode/python/python";
import "codemirror/mode/clike/clike";
import "codemirror/mode/rust/rust";

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

const boilerplates = {
  "nodejs-20.17.0":    '// JavaScript (Node.js)\nconsole.log("Hello, World!");',
  "cpython-3.12.7":    '# Python\nprint("Hello, World!")',
  "gcc-13.2.0-c":      '// C\n#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
  "gcc-13.2.0":        '// C++\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
  "openjdk-jdk-21+35": '// Java\npublic class prog {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  "rust-1.82.0":       '// Rust\nfn main() {\n    println!("Hello, World!");\n}',
};

const getMode = (lang) => {
  if (lang.includes("nodejs"))  return "javascript";
  if (lang.includes("python"))  return "python";
  if (lang === "gcc-13.2.0-c")  return "text/x-csrc";
  if (lang === "gcc-13.2.0")    return "text/x-c++src";
  if (lang.includes("openjdk")) return "text/x-java";
  if (lang.includes("rust"))    return "rust";
  return "javascript";
};

const Editor = ({ socketRef, roomId, onCodeChange, language }) => {
  const editorRef      = useRef(null);
  const prevLangRef    = useRef(language);

  // Initialize once
  useEffect(() => {
    if (editorRef.current) return;

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
        lint: language.includes("nodejs"),
      }
    );

    editorRef.current.setValue(boilerplates[language] || "");
    editorRef.current.setSize(null, "100%");

    editorRef.current.on("change", (instance, changes) => {
      const code = instance.getValue();
      onCodeChange(code);
      if (changes.origin !== "setValue") {
        socketRef.current.emit(ACTIONS.CODE_CHANGE, { roomId, code });
      }
    });
  }, []); // eslint-disable-line

  // React to language change
  useEffect(() => {
    if (!editorRef.current || prevLangRef.current === language) return;

    editorRef.current.setOption("mode", getMode(language));
    editorRef.current.setOption("lint", language.includes("nodejs"));

    const current = editorRef.current.getValue();
    const isDefault =
      Object.values(boilerplates).some((b) => b.trim() === current.trim()) ||
      current.trim() === "";

    if (isDefault) {
      const bp = boilerplates[language] || "";
      editorRef.current.setValue(bp);
      onCodeChange(bp);
    }

    prevLangRef.current = language;
  }, [language]); // eslint-disable-line

  // Sync remote code changes
  useEffect(() => {
    if (!socketRef.current) return;
    socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
      if (code !== null && editorRef.current && editorRef.current.getValue() !== code) {
        editorRef.current.setValue(code);
      }
    });
    return () => socketRef.current?.off(ACTIONS.CODE_CHANGE);
  }, [socketRef]);

  return (
    <div style={{ height: "100%" }}>
      <textarea id="realtimeEditor" />
    </div>
  );
};

export default Editor;

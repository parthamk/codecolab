import React, { useEffect, useRef } from "react";
import "codemirror/mode/javascript/javascript";
import "codemirror/theme/dracula.css";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import "codemirror/lib/codemirror.css";
import CodeMirror from "codemirror";
import { ACTIONS } from "../Actions";

const Editor = ({ socketRef, roomId, onCodeChange, username }) => {
  const editorRef = useRef(null);

  // const handleHighlight = () => {
  //   const { from, to } = editorRef.current.getSelection();
  //   socketRef.current.emit(ACTIONS.TEXT_HIGHLIGHT, {
  //     roomId,
  //     from,
  //     to,
  //     // You can also include username or other metadata if needed
  //   });
  // };

  useEffect(() => {
    if (socketRef.current) {
      const handleTextHighlight = ({ from, to }) => {
        editorRef.current.markText(from, to, { className: "highlighted-text" });
      };

      socketRef.current.on(ACTIONS.TEXT_HIGHLIGHT, handleTextHighlight);

      return () => {
        socketRef.current.off(ACTIONS.TEXT_HIGHLIGHT, handleTextHighlight);
      };
    }
  }, [socketRef.current]);

  useEffect(() => {
    const initEditor = () => {
      const editor = CodeMirror.fromTextArea(
        document.getElementById("realtimeEditor"),
        {
          mode: { name: "javascript", json: true },
          theme: "dracula",
          autoCloseTags: true,
          autoCloseBrackets: true,
          lineNumbers: true,
        }
      );
      editorRef.current = editor;

      editor.setSize(null, "100%");
      editorRef.current.on("change", (instance, changes) => {
        const { origin } = changes;
        const code = instance.getValue();
        onCodeChange(code);
        if (origin !== "setValue") {
          socketRef.current.emit(ACTIONS.CODE_CHANGE, {
            roomId,
            code,
          });
        }
      });
    };

    initEditor();
  }, []);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
        if (code !== null) {
          editorRef.current.setValue(code);
        }
      });
    }
    return () => {
      socketRef.current.off(ACTIONS.CODE_CHANGE);
    };
  }, [socketRef.current]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      const updateCursorActivity = () => {
        const cursorPos = editor.getCursor();
        const coords = editor.charCoords(cursorPos, "window");
        socketRef.current.emit(ACTIONS.CURSOR_ACTIVITY, {
          username,
          roomId,
          cursorPosition: coords,
        });

        let overlay = document.getElementById("cursor-overlay");
        if (!overlay) {
          overlay = document.createElement("div");
          overlay.id = "cursor-overlay";
          document.body.appendChild(overlay);
        }
        overlay.style.position = "absolute";
        overlay.style.left = `${coords.left}px`;
        overlay.style.top = `${
          coords.top + parseInt(overlay.style.fontSize, 10) + 5
        }px`;
        overlay.style.fontSize = "10px";
        overlay.style.color = "yellow";
        overlay.innerText = `${username} is typing`;
      };

      editor.on("cursorActivity", updateCursorActivity);

      return () => {
        editor.off("cursorActivity", updateCursorActivity);
        const overlay = document.getElementById("cursor-overlay");
        if (overlay) {
          overlay.remove();
        }
      };
    }
  }, [username, socketRef.current, roomId]);

  return (
    <div style={{ height: "600px" }}>
      <textarea id="realtimeEditor"></textarea>
    </div>
  );
};

export default Editor;

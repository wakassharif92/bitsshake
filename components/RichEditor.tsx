import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import { Highlight } from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Palette,
  Highlighter,
  Grid3x3,
} from "lucide-react";
import { useEffect, useState } from "react";

interface RichEditorProps {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
}

export default function RichEditor({
  content,
  onChange,
  readOnly = false,
}: RichEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [textColor, setTextColor] = useState("#000000");
  const [highlightColor, setHighlightColor] = useState("#FFF00");
  const [showHeadingDropdown, setShowHeadingDropdown] = useState(false);

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      BulletList.configure({
        HTMLAttributes: {
          class: "list-disc list-outside ml-6 text-black",
        },
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: "list-decimal list-outside ml-6 text-black",
        },
      }),
      ListItem.configure({
        HTMLAttributes: {
          class: "text-black",
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph", "bulletList", "orderedList"],
        alignments: ["left", "center", "right"],
        defaultAlignment: "left",
      }),
      Color.configure({
        types: ["textStyle"],
      }),
      TextStyle,
      FontFamily.configure({
        types: ["textStyle"],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content || "<p></p>",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (editor && content) {
      const currentHtml = editor.getHTML();
      if (currentHtml !== content) {
        editor.commands.setContent(content);
      }
    }
  }, [content, editor]);

  if (!mounted || !editor) {
    return (
      <div className="flex items-center justify-center p-4">
        Loading editor...
      </div>
    );
  }

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleUnderline = () => editor.chain().focus().toggleUnderline().run();
  const toggleBulletList = () =>
    editor.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () =>
    editor.chain().focus().toggleOrderedList().run();
  const toggleHeading2 = () =>
    editor.chain().focus().toggleHeading({ level: 2 }).run();
  const setAlignLeft = () => editor.chain().focus().setTextAlign("left").run();
  const setAlignCenter = () =>
    editor.chain().focus().setTextAlign("center").run();
  const setAlignRight = () =>
    editor.chain().focus().setTextAlign("right").run();
  const undo = () => editor.chain().focus().undo().run();
  const redo = () => editor.chain().focus().redo().run();

  const isButtonActive = (name: string) => {
    switch (name) {
      case "bold":
        return editor.isActive("bold");
      case "italic":
        return editor.isActive("italic");
      case "underline":
        return editor.isActive("underline");
      case "bulletList":
        return editor.isActive("bulletList");
      case "orderedList":
        return editor.isActive("orderedList");
      case "heading1":
        return editor.isActive("heading", { level: 1 });
      case "heading2":
        return editor.isActive("heading", { level: 2 });
      case "heading3":
        return editor.isActive("heading", { level: 3 });
      case "heading4":
        return editor.isActive("heading", { level: 4 });
      case "alignLeft": {
        const alignment =
          editor.getAttributes("paragraph")?.textAlign || "left";
        return alignment === "left" || editor.isActive({ textAlign: "left" });
      }
      case "alignCenter": {
        const alignment =
          editor.getAttributes("paragraph")?.textAlign || "left";
        return (
          alignment === "center" || editor.isActive({ textAlign: "center" })
        );
      }
      case "alignRight": {
        const alignment =
          editor.getAttributes("paragraph")?.textAlign || "left";
        return alignment === "right" || editor.isActive({ textAlign: "right" });
      }
      default:
        return false;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-gray-300 bg-gray-50 p-2 flex flex-wrap gap-1">
        {/* Undo/Redo */}
        <button
          onClick={undo}
          disabled={!editor.can().undo()}
          className="p-2 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed text-black"
          title="Undo"
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={redo}
          disabled={!editor.can().redo()}
          className="p-2 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed text-black"
          title="Redo"
        >
          <Redo2 size={18} />
        </button>

        <div className="w-px bg-gray-300"></div>

        {/* Heading Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowHeadingDropdown(!showHeadingDropdown)}
            className={`px-3 py-2 rounded text-black flex items-center gap-1 min-w-[80px] ${
              editor.isActive("heading")
                ? "bg-blue-200 text-blue-700"
                : "hover:bg-gray-200"
            }`}
            title="Headings"
          >
            <span className="text-sm font-medium">
              {editor.isActive("heading", { level: 1 })
                ? "H1"
                : editor.isActive("heading", { level: 2 })
                  ? "H2"
                  : editor.isActive("heading", { level: 3 })
                    ? "H3"
                    : editor.isActive("heading", { level: 4 })
                      ? "H4"
                      : "Normal"}
            </span>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {showHeadingDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10 min-w-[120px]">
              <button
                onClick={() => {
                  editor.chain().focus().setParagraph().run();
                  setShowHeadingDropdown(false);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 text-black ${
                  !editor.isActive("heading") ? "bg-blue-50" : ""
                }`}
              >
                <span className="text-base">Normal</span>
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().setHeading({ level: 1 }).run();
                  setShowHeadingDropdown(false);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 text-black ${
                  isButtonActive("heading1") ? "bg-blue-50" : ""
                }`}
              >
                <span className="text-2xl font-bold">H1</span>
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().setHeading({ level: 2 }).run();
                  setShowHeadingDropdown(false);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 text-black ${
                  isButtonActive("heading2") ? "bg-blue-50" : ""
                }`}
              >
                <span className="text-xl font-bold">H2</span>
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().setHeading({ level: 3 }).run();
                  setShowHeadingDropdown(false);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 text-black ${
                  isButtonActive("heading3") ? "bg-blue-50" : ""
                }`}
              >
                <span className="text-lg font-bold">H3</span>
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().setHeading({ level: 4 }).run();
                  setShowHeadingDropdown(false);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 text-black ${
                  isButtonActive("heading4") ? "bg-blue-50" : ""
                }`}
              >
                <span className="text-base font-bold">H4</span>
              </button>
            </div>
          )}
        </div>

        {/* Text formatting */}

        <button
          onClick={toggleBold}
          className={`p-2 rounded text-black ${
            isButtonActive("bold")
              ? "bg-blue-200 text-blue-700"
              : "hover:bg-gray-200"
          }`}
          title="Bold"
        >
          <Bold size={18} />
        </button>

        <button
          onClick={toggleItalic}
          className={`p-2 rounded text-black ${
            isButtonActive("italic")
              ? "bg-blue-200 text-blue-700"
              : "hover:bg-gray-200"
          }`}
          title="Italic"
        >
          <Italic size={18} />
        </button>

        <button
          onClick={toggleUnderline}
          className={`p-2 rounded text-black ${
            isButtonActive("underline")
              ? "bg-blue-200 text-blue-700"
              : "hover:bg-gray-200"
          }`}
          title="Underline"
        >
          <UnderlineIcon size={18} />
        </button>

        <div className="w-px bg-gray-300"></div>

        {/* Lists */}
        <button
          onClick={toggleBulletList}
          className={`p-2 rounded text-black ${
            isButtonActive("bulletList")
              ? "bg-blue-200 text-blue-700"
              : "hover:bg-gray-200"
          }`}
          title="Bullet List"
        >
          <List size={18} />
        </button>

        <button
          onClick={toggleOrderedList}
          className={`p-2 rounded text-black ${
            isButtonActive("orderedList")
              ? "bg-blue-200 text-blue-700"
              : "hover:bg-gray-200"
          }`}
          title="Ordered List"
        >
          <ListOrdered size={18} />
        </button>

        <div className="w-px bg-gray-300"></div>

        {/* Alignment */}
        <button
          onClick={setAlignLeft}
          className={`p-2 rounded text-black ${
            isButtonActive("alignLeft")
              ? "bg-blue-200 text-blue-700"
              : "hover:bg-gray-200"
          }`}
          title="Align Left"
        >
          <AlignLeft size={18} />
        </button>

        <button
          onClick={setAlignCenter}
          className={`p-2 rounded text-black ${
            isButtonActive("alignCenter")
              ? "bg-blue-200 text-blue-700"
              : "hover:bg-gray-200"
          }`}
          title="Align Center"
        >
          <AlignCenter size={18} />
        </button>

        <button
          onClick={setAlignRight}
          className={`p-2 rounded text-black ${
            isButtonActive("alignRight")
              ? "bg-blue-200 text-blue-700"
              : "hover:bg-gray-200"
          }`}
          title="Align Right"
        >
          <AlignRight size={18} />
        </button>

        <div className="w-px bg-gray-300"></div>

        {/* Text Color */}
        <div className="flex flex-col items-center gap-1">
          <label className="text-xs text-gray-600">Font</label>
          <input
            type="color"
            value={textColor}
            onChange={(e) => {
              setTextColor(e.target.value);
              editor?.chain().focus().setColor(e.target.value).run();
            }}
            className="w-8 h-8 cursor-pointer rounded"
            title="Text Color"
          />
        </div>

        {/* Highlight Color */}
        <div className="flex flex-col items-center gap-1">
          <label className="text-xs text-gray-600">Highlight</label>
          <input
            type="color"
            value={highlightColor}
            onChange={(e) => {
              setHighlightColor(e.target.value);
              editor
                ?.chain()
                .focus()
                .setHighlight({ color: e.target.value })
                .run();
            }}
            className="w-8 h-8 cursor-pointer rounded"
            title="Highlight Color"
          />
        </div>

        {/* Font Family */}
        <select
          onChange={(e) => {
            if (e.target.value) {
              editor?.chain().focus().setFontFamily(e.target.value).run();
            }
          }}
          className="px-2 py-1 border border-gray-300 rounded text-sm text-black"
          title="Font Family"
        >
          <option value="">Default</option>
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
        </select>

        <div className="w-px bg-gray-300"></div>

        {/* Insert Table */}
        <button
          onClick={() => {
            editor
              ?.chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run();
          }}
          className="p-2 rounded text-black hover:bg-gray-200"
          title="Insert Table"
        >
          <Grid3x3 size={18} />
        </button>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="flex-1 overflow-auto p-4 text-black [&_.ProseMirror]:text-black [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-black [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:text-black [&_li]:text-black [&_h1]:text-4xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-5 [&_h3]:text-2xl [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h4]:text-xl [&_h4]:font-bold [&_h4]:mb-2 [&_h4]:mt-3"
      />
    </div>
  );
}

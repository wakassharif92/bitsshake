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
}

export default function RichEditor({ content, onChange }: RichEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [textColor, setTextColor] = useState("#000000");
  const [highlightColor, setHighlightColor] = useState("#FFF00");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
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
      case "heading2":
        return editor.isActive("heading", { level: 2 });
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

        {/* Text formatting */}
        <button
          onClick={toggleHeading2}
          className={`p-2 rounded text-black ${
            isButtonActive("heading2")
              ? "bg-blue-200 text-blue-700"
              : "hover:bg-gray-200"
          }`}
          title="Heading 2"
        >
          <Heading2 size={18} />
        </button>

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
        <div className="flex items-center">
          <input
            type="color"
            value={textColor}
            onChange={(e) => {
              setTextColor(e.target.value);
              editor?.chain().focus().setColor(e.target.value).run();
            }}
            className="w-10 h-10 cursor-pointer rounded"
            title="Text Color"
          />
        </div>

        {/* Highlight Color */}
        <div className="flex items-center">
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
            className="w-10 h-10 cursor-pointer rounded"
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
        className="flex-1 overflow-auto p-4 text-black [&_.ProseMirror]:text-black [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-black [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:text-black [&_li]:text-black"
      />
    </div>
  );
}

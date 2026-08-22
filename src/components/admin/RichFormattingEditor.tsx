import React, { useState, useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Link as LinkIcon, 
  Eye, 
  Edit3, 
  Code, 
  Info,
  Check,
  HelpCircle
} from 'lucide-react';

interface RichFormattingEditorProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  minHeight?: string;
  error?: string;
  helperText?: string;
}

export const RichFormattingEditor: React.FC<RichFormattingEditorProps> = ({
  label,
  value = '',
  onChange,
  placeholder = 'Write comprehensive, well-formatted content here...',
  required = false,
  minHeight = 'min-h-[220px]',
  error,
  helperText
}) => {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [showTips, setShowTips] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;

  const insertFormatting = (prefix: string, suffix: string = '', defaultText: string = 'text') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || defaultText;

    const before = value.substring(0, start);
    const after = value.substring(end);

    const newText = `${before}${prefix}${selectedText}${suffix}${after}`;
    onChange(newText);

    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const insertLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const before = value.substring(0, start);
    const after = value.substring(start);

    // If not at beginning of line, add newline
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const insertString = (needsNewline ? '\n' : '') + prefix + ' ';

    const newText = `${before}${insertString}${after}`;
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + insertString.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const handleInsertLink = () => {
    const url = window.prompt('Enter destination URL:', 'https://');
    if (!url) return;
    const linkText = window.prompt('Enter link display text:', 'Click here') || url;
    insertFormatting(`[${linkText}](`, `${url})`, '');
  };

  // Preview Markdown Parser
  const renderPreview = (content: string) => {
    if (!content.trim()) {
      return (
        <div className="text-slate-400 text-xs italic py-8 text-center">
          No content written yet. Switch to "Write" tab to begin composing.
        </div>
      );
    }

    const paragraphs = content.split('\n\n');
    return (
      <div className="space-y-3.5 text-xs text-slate-800 leading-relaxed font-sans">
        {paragraphs.map((para, idx) => {
          const trimmed = para.trim();
          if (!trimmed) return null;

          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-base font-extrabold text-slate-900 mt-4 mb-2 pb-1 border-b border-slate-200">
                {trimmed.replace(/^##\s+/, '')}
              </h2>
            );
          }

          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-sm font-bold text-slate-900 mt-3 mb-1 text-[#0F4C81]">
                {trimmed.replace(/^###\s+/, '')}
              </h3>
            );
          }

          if (trimmed.startsWith('> ') || trimmed.startsWith('IMPORTANT:') || trimmed.startsWith('NOTE:')) {
            const clean = trimmed.replace(/^>\s*(\[IMPORTANT\]|IMPORTANT:?|\[NOTE\]|NOTE:?)/i, '').replace(/^(IMPORTANT:|NOTE:)/i, '').trim();
            return (
              <div key={idx} className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-amber-950 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px] mb-1">
                  <Info className="w-3.5 h-3.5 text-amber-700" />
                  <span>Important Note</span>
                </div>
                <p className="pl-5 text-amber-900/90">{clean || trimmed.replace(/^>\s*/, '')}</p>
              </div>
            );
          }

          if (trimmed.split('\n').every(line => line.trim().startsWith('- ') || line.trim().startsWith('* '))) {
            const items = trimmed.split('\n').map(l => l.trim().replace(/^[-*]\s+/, ''));
            return (
              <ul key={idx} className="space-y-1.5 pl-2 list-none">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0F4C81] mt-1.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          }

          if (trimmed.split('\n').every(line => /^\d+\.\s+/.test(line.trim()))) {
            const items = trimmed.split('\n').map(l => l.trim().replace(/^\d+\.\s+/, ''));
            return (
              <ol key={idx} className="space-y-1.5 pl-2 list-none">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-700">
                    <span className="w-4 h-4 rounded bg-blue-50 text-[#0F4C81] font-bold text-[10px] flex items-center justify-center shrink-0 border border-blue-200">
                      {i + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            );
          }

          // Format bold and italic spans in standard paragraphs
          const formattedLines = trimmed.split('\n').map((line, lIdx) => {
            // Simple replace of **bold** and *italic*
            return (
              <span key={lIdx} className="block">
                {line}
              </span>
            );
          });

          return (
            <p key={idx} className="text-slate-700 leading-relaxed">
              {formattedLines}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-1.5 font-sans">
      {/* Label and Mode Switcher */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTips(!showTips)}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
            title="Formatting shortcuts"
          >
            <HelpCircle className="w-3 h-3" /> Shortcuts
          </button>

          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab('write')}
              className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                activeTab === 'write'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3 h-3" /> Write
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                activeTab === 'preview'
                  ? 'bg-white text-[#0F4C81] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3 h-3" /> Live Preview
            </button>
          </div>
        </div>
      </div>

      {/* Shortcuts helper drawer */}
      {showTips && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900 grid grid-cols-2 sm:grid-cols-4 gap-2 animate-in fade-in duration-150">
          <div><span className="font-mono font-bold">**Bold Text**</span> → <strong>Bold</strong></div>
          <div><span className="font-mono font-bold">*Italic Text*</span> → <em>Italic</em></div>
          <div><span className="font-mono font-bold">## Heading</span> → H2 Title</div>
          <div><span className="font-mono font-bold">- Bullet Item</span> → List</div>
        </div>
      )}

      {/* Editor Box */}
      <div className={`border rounded-2xl overflow-hidden bg-white transition-all ${
        error ? 'border-red-400 ring-2 ring-red-400/10' : 'border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 shadow-2xs'
      }`}>
        
        {/* Formatting Toolbar */}
        {activeTab === 'write' && (
          <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex flex-wrap items-center gap-1 text-slate-600">
            <button
              type="button"
              onClick={() => insertFormatting('**', '**', 'bold text')}
              className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition text-xs font-bold"
              title="Bold (**text**)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('*', '*', 'italic text')}
              className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition text-xs"
              title="Italic (*text*)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-300 mx-1" />

            <button
              type="button"
              onClick={() => insertLinePrefix('##')}
              className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition text-xs"
              title="Heading 2 (## Title)"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertLinePrefix('###')}
              className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition text-xs"
              title="Heading 3 (### Subtitle)"
            >
              <Heading3 className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-300 mx-1" />

            <button
              type="button"
              onClick={() => insertLinePrefix('-')}
              className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition text-xs"
              title="Bullet List (- item)"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertLinePrefix('1.')}
              className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition text-xs"
              title="Numbered List (1. item)"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertLinePrefix('> [IMPORTANT]')}
              className="p-1.5 hover:bg-white hover:text-amber-700 rounded-lg transition text-xs"
              title="Important Notice Box (> [IMPORTANT])"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-300 mx-1" />

            <button
              type="button"
              onClick={handleInsertLink}
              className="p-1.5 hover:bg-white hover:text-blue-700 rounded-lg transition text-xs"
              title="Insert Link [Text](url)"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Write or Preview Body */}
        {activeTab === 'write' ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full p-3.5 text-xs text-slate-800 font-sans leading-relaxed focus:outline-none resize-y ${minHeight} bg-white`}
          />
        ) : (
          <div className={`p-4 bg-slate-50/50 ${minHeight} overflow-y-auto`}>
            {renderPreview(value)}
          </div>
        )}

        {/* Footer Metrics */}
        <div className="bg-slate-50/80 border-t border-slate-200/80 px-3 py-1.5 flex items-center justify-between text-[10px] text-slate-400 font-medium">
          <div>
            {helperText && <span>{helperText}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span><strong>{wordCount}</strong> words</span>
            <span><strong>{charCount}</strong> characters</span>
          </div>
        </div>

      </div>

      {error && (
        <p className="text-[11px] font-bold text-red-500 mt-1 flex items-center gap-1">
          <span>⚠️ {error}</span>
        </p>
      )}
    </div>
  );
};

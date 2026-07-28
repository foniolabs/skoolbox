import { useState, useEffect, useRef, useCallback } from 'react';
import { Library, Upload, Trash2, Loader2, Check, AlertCircle, FileText, Database, Package, Download } from 'lucide-react';
import mammoth from 'mammoth';
import {
  ingestCurriculumText,
  listCurriculumDocuments,
  deleteCurriculumDocument,
  curriculumStats,
  exportCurriculumPack,
  importCurriculumPack,
  getSubjects,
  type CurriculumDocument,
  type CurriculumStats,
} from '../lib/tauri/commands';
import CustomDropdown from '../components/shared/CustomDropdown';
import Button from '../components/shared/Button';

const classLevelOptions = [
  { label: 'Pry 5', value: 'Pry 5' },
  { label: 'Pry 6', value: 'Pry 6' },
  { label: 'JSS1', value: 'JSS1' },
  { label: 'JSS2', value: 'JSS2' },
  { label: 'JSS3', value: 'JSS3' },
  { label: 'SS1', value: 'SS1' },
  { label: 'SS2', value: 'SS2' },
  { label: 'SS3', value: 'SS3' },
];

const sourceTypeOptions = [
  { label: 'Textbook', value: 'textbook' },
  { label: 'Curriculum / Syllabus', value: 'curriculum' },
  { label: 'Past Questions (WAEC/NECO)', value: 'past_questions' },
  { label: 'Lesson Notes', value: 'lesson_notes' },
];

const sourceTypeLabels: Record<string, string> = {
  textbook: 'Textbook',
  curriculum: 'Curriculum',
  past_questions: 'Past Questions',
  lesson_notes: 'Lesson Notes',
};

export default function CurriculumLibraryPage() {
  const [docs, setDocs] = useState<CurriculumDocument[]>([]);
  const [stats, setStats] = useState<CurriculumStats>({ documents: 0, chunks: 0 });
  const [subjectOptions, setSubjectOptions] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [classLevel, setClassLevel] = useState('JSS1');
  const [sourceType, setSourceType] = useState('textbook');
  const [content, setContent] = useState('');

  const [ingesting, setIngesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Curriculum pack export/import
  const [packBusy, setPackBusy] = useState(false);
  const packInputRef = useRef<HTMLInputElement>(null);

  const handleExportPack = async () => {
    setErrorMsg(''); setSuccessMsg(''); setPackBusy(true);
    try {
      const version = new Date().toISOString().slice(0, 10); // e.g. 2026-06-14
      const path = await exportCurriculumPack('SkoolBox Curriculum Pack', version);
      setSuccessMsg(`Pack exported to: ${path}`);
    } catch (err) {
      setErrorMsg(typeof err === 'string' ? err : 'Could not export the curriculum pack.');
    } finally {
      setPackBusy(false);
    }
  };

  const handleImportPack = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(''); setSuccessMsg(''); setPackBusy(true);
    try {
      const json = await file.text();
      const replace = confirm('Replace the existing curriculum with this pack?\n\nOK = replace (recommended for an official update)\nCancel = add to what is already here');
      const summary = await importCurriculumPack(json, replace);
      setSuccessMsg(`Imported ${summary.documents} document${summary.documents === 1 ? '' : 's'} (${summary.chunks} passages)${summary.replaced ? ', replacing the old curriculum' : ''}.`);
      await loadAll();
    } catch (err) {
      setErrorMsg(typeof err === 'string' ? err : 'Could not import the pack — is it a valid SkoolBox curriculum pack?');
    } finally {
      setPackBusy(false);
      if (packInputRef.current) packInputRef.current.value = '';
    }
  };

  const loadAll = useCallback(async () => {
    try {
      const [docList, statData, subjects] = await Promise.all([
        listCurriculumDocuments(),
        curriculumStats(),
        getSubjects(),
      ]);
      setDocs(docList);
      setStats(statData);
      // Distinct subject names so ingested docs match what lessons query.
      const names = Array.from(new Set(subjects.map((s) => s.name))).sort();
      const opts = names.map((n) => ({ label: n, value: n }));
      setSubjectOptions(opts);
      if (opts.length > 0) setSubject((prev) => prev || opts[0].value);
    } catch (err) {
      console.error('Failed to load curriculum library:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg('');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let text = '';

      if (ext === 'txt' || ext === 'md') {
        text = await file.text();
      } else if (ext === 'docx' || ext === 'doc') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
        if (result.messages.length > 0) console.warn('mammoth warnings:', result.messages);
      } else {
        setErrorMsg('Unsupported file type. Please use .docx, .doc, .txt, or .md.');
        return;
      }

      if (!text.trim()) {
        setErrorMsg('The file appears to be empty or could not be read.');
        return;
      }

      setContent((prev) => (prev.trim() ? `${prev}\n\n---\n\n${text.trim()}` : text.trim()));
      // Auto-fill the title from the filename if it's still empty.
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^.]+$/, ''));
      }
    } catch {
      setErrorMsg('Failed to read file. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleIngest = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!title.trim()) {
      setErrorMsg('Please give the document a title.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Please upload a file or paste some text to add to the library.');
      return;
    }
    setIngesting(true);
    try {
      const result = await ingestCurriculumText({
        title: title.trim(),
        subject,
        classLevel,
        sourceType,
        content: content.trim(),
      });
      setSuccessMsg(`Added "${title.trim()}" — indexed ${result.chunks} passage${result.chunks === 1 ? '' : 's'}. Martha can now use it.`);
      setTitle('');
      setContent('');
      await loadAll();
    } catch (err) {
      setErrorMsg(typeof err === 'string' ? err : 'Failed to add document to the library.');
    } finally {
      setIngesting(false);
    }
  };

  const handleDelete = async (doc: CurriculumDocument) => {
    if (!confirm(`Remove "${doc.title}" from the library? Martha will no longer use it.`)) return;
    try {
      await deleteCurriculumDocument(doc.id);
      await loadAll();
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const inputClass =
    'px-3 py-2.5 rounded-[12px] border border-border bg-bg-secondary/50 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary';

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Library className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Curriculum Library</h1>
            <p className="text-sm text-text-secondary">
              Feed Martha textbooks, curriculum and past questions. She retrieves from these to teach grounded in real content.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Curriculum pack export/import */}
          <input ref={packInputRef} type="file" accept=".json" className="hidden" onChange={handleImportPack} />
          <button onClick={() => packInputRef.current?.click()} disabled={packBusy}
            title="Import a curriculum pack (apply an update)"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[12px] border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50">
            {packBusy ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />} Import pack
          </button>
          <button onClick={handleExportPack} disabled={packBusy}
            title="Export everything as a curriculum pack (for distribution)"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[12px] border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50">
            <Download size={14} /> Export pack
          </button>
          <div className="hidden md:flex items-center gap-2 rounded-[14px] bg-bg-secondary/60 px-4 py-2.5">
            <Database className="w-4 h-4 text-primary" />
            <div className="text-sm">
              <span className="font-semibold text-text-primary">{stats.documents}</span>
              <span className="text-text-muted"> docs · </span>
              <span className="font-semibold text-text-primary">{stats.chunks}</span>
              <span className="text-text-muted"> passages</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add to Library */}
      <div className="bg-white rounded-[20px] shadow-card p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Add to Library</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title — e.g. NERDC JSS1 Maths Textbook"
            className={inputClass}
          />
          <CustomDropdown
            options={subjectOptions.length ? subjectOptions : [{ label: 'No subjects found', value: '' }]}
            value={subject}
            onChange={setSubject}
          />
          <CustomDropdown options={classLevelOptions} value={classLevel} onChange={setClassLevel} />
          <CustomDropdown options={sourceTypeOptions} value={sourceType} onChange={setSourceType} />
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste curriculum / textbook text here, or upload a file below…"
          rows={8}
          className={`${inputClass} w-full resize-y font-mono text-xs leading-relaxed`}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.doc,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[12px] border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload .docx / .txt
            </button>
            {content.trim() && (
              <span className="text-xs text-text-muted">
                {content.trim().length.toLocaleString()} characters ready
              </span>
            )}
          </div>
          <Button onClick={handleIngest} disabled={ingesting}>
            {ingesting ? 'Adding…' : 'Add to Library'}
          </Button>
        </div>

        {/* Feedback */}
        {successMsg && (
          <div className="flex items-start gap-2 mt-3 rounded-[12px] bg-green-50 px-4 py-3 text-sm text-green-700">
            <Check size={16} className="mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-start gap-2 mt-3 rounded-[12px] bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Ingested Documents */}
      <div className="bg-white rounded-[20px] shadow-card p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          In the Library {docs.length > 0 && <span className="text-text-muted font-normal">({docs.length})</span>}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-text-muted">
            <FileText className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Nothing here yet. Add a textbook or curriculum document above to ground Martha&apos;s teaching.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-[14px] border border-border px-4 py-3 hover:border-primary/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-text-primary truncate">{doc.title}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {doc.subject && <Chip>{doc.subject}</Chip>}
                    {doc.class_level && <Chip>{doc.class_level}</Chip>}
                    <Chip>{sourceTypeLabels[doc.source_type] ?? doc.source_type}</Chip>
                    <span className="text-xs text-text-muted">{doc.chunk_count} passages</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc)}
                  title="Remove from library"
                  className="flex items-center justify-center h-9 w-9 rounded-[12px] text-red-400 hover:bg-red-50 transition-colors shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs font-medium text-text-secondary">
      {children}
    </span>
  );
}

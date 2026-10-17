import { useRef, useState, type ReactNode } from 'react';

/** Upload area with drag and drop. Still keyboard-usable through its button. */
export function Dropzone({
  accept,
  multiple,
  onFiles,
  title,
  help,
  button,
  busy,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title: string;
  help: ReactNode;
  button: string;
  busy?: string | null;
}) {
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={
        'flex w-full max-w-[760px] flex-col items-center rounded-[4px] border border-dashed px-6 py-12 text-center ' +
        (over ? 'border-ink bg-select' : 'border-input bg-panel')
      }
    >
      <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" className="text-muted">
        <path d="M12 16V4m0 0L7 9m5-5l5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="m-0 mt-3 font-semibold">{busy ?? title}</p>
      <p className="mb-4 mt-1 max-w-[420px] text-muted">{help}</p>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
      <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => ref.current?.click()}>
        {button}
      </button>
    </div>
  );
}

/** Small file-picker button for headers (Replace, Add slide). */
export function FileButton({ accept, multiple, onFiles, label, disabled }: { accept: string; multiple?: boolean; onFiles: (f: File[]) => void; label: string; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
      <button type="button" className="btn" disabled={disabled} onClick={() => ref.current?.click()}>
        {label}
      </button>
    </>
  );
}

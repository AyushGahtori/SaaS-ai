"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: string;
  onUploaded: (imageId: string, previewUrl: string) => void;
  onClear?: () => void;
  previewUrl?: string | null;
  className?: string;
}

export default function ImageUpload({
  sessionId,
  onUploaded,
  onClear,
  previewUrl,
  className,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image must be under 10 MB.");
        return;
      }

      setUploading(true);
      const preview = URL.createObjectURL(file);
      try {
        const { uploadImage } = await import("@/lib/api");
        const res = await uploadImage(file, sessionId);
        onUploaded(res.image_id, preview);
        toast.success("Product image ready!");
      } catch (err: any) {
        URL.revokeObjectURL(preview);
        toast.error(err?.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [sessionId, onUploaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // Already has an uploaded image — show preview
  if (previewUrl) {
    return (
      <div className={cn("relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="Product" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
          {onClear && (
            <button
              onClick={onClear}
              className="w-6 h-6 rounded-full bg-black/70 flex items-center justify-center"
            >
              <X size={11} className="text-white" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        `relative flex items-center justify-center rounded-xl border-2 border-dashed
         transition-all duration-150 cursor-pointer select-none
         ${dragging
           ? "border-violet-500 bg-violet-500/10"
           : "border-[#2a2a36] hover:border-violet-600/50 hover:bg-violet-600/5"
         }`,
        className
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <div className="flex flex-col items-center gap-1.5 p-4 text-center pointer-events-none">
        {uploading ? (
          <div className="w-8 h-8 rounded-xl bg-violet-600/20 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-[#1a1a26] border border-[#2a2a36] flex items-center justify-center">
            <ImageIcon size={14} className="text-neutral-500" />
          </div>
        )}
        <span className="text-[11px] text-neutral-600">
          {uploading ? "Uploading…" : "Drop image or click"}
        </span>
      </div>
    </div>
  );
}

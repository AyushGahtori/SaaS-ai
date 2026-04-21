"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Cloud, Cpu, Sparkles } from "lucide-react";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { AttachFile } from "@/modules/home/ui/components/attach-file";
import { TextToSpeech } from "@/modules/home/ui/components/text-to-speech";
import { useChatAttachments } from "@/modules/chat/upload/use-chat-attachments";
import { AttachmentStrip } from "@/modules/chat/upload/components/attachment-strip";
import { DrivePickerDialog } from "@/modules/chat/upload/components/drive-picker-dialog";
import { DriveUploadSigninOverlay } from "@/modules/chat/upload/components/drive-upload-signin-overlay";
import {
  extractClipboardFiles,
  readClipboardFilesFallback,
} from "@/modules/chat/upload/clipboard-files";
import { SendStopButton } from "@/modules/chat/ui/components/send-stop-button";
import VoiceBar from "@/modules/chat/ui/components/VoiceBar";
import { ThemedInlineError } from "@/components/error-ui/themed-inline-error";
import { normalizeUserFacingError } from "@/lib/errors/user-facing-errors";

interface ChatInputProps {
  onFirstMessage?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onFirstMessage }) => {
  const {
    sendMessage,
    isGenerating,
    isStopping,
    stopGeneration,
    selectedModel,
    setSelectedModel,
    availableModels,
    isVoiceActive,
    setIsVoiceActive,
  } = useChatContext();

  const [value, setValue] = useState("");
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const {
    attachments,
    attachError,
    setAttachError,
    isDriveDialogOpen,
    setIsDriveDialogOpen,
    driveSearch,
    setDriveSearch,
    driveFiles,
    isLoadingDrive,
    showDriveSigninOverlay,
    setShowDriveSigninOverlay,
    signInForDrivePicker,
    isDriveSigninReady,
    isDriveSigningIn,
    driveSigninError,
    pendingUploads,
    readyAttachments,
    failedAttachments,
    modelSupportsUpload,
    fileInputRef,
    removeAttachment,
    openComputerPicker,
    addComputerFiles,
    openDrivePicker,
    handleComputerFilesSelected,
    handleDroppedFiles,
    addDriveAttachment,
    clearAttachments,
    restoreAttachments,
  } = useChatAttachments(selectedModel);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [value]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSend = async () => {
    const previousDraft = value;
    const trimmed = previousDraft.trim();
    if ((!trimmed && attachments.length === 0) || isGenerating) return;
    if (pendingUploads > 0) return;

    if (attachments.length > 0 && !modelSupportsUpload) {
      setAttachError("This model does not support file upload. Switch to a Gemini model.");
      return;
    }

    if (attachments.length > 0 && readyAttachments.length === 0 && trimmed.length === 0) {
      setAttachError("No valid file is ready yet. Please remove failed files or upload again.");
      return;
    }

    const snapshot = [...attachments];
    setValue("");
    onFirstMessage?.();
    clearAttachments();

    const content = trimmed || "Please analyze the attached file.";
    try {
      const result = await sendMessage(content, false, readyAttachments, failedAttachments);
      if (!result) {
        restoreAttachments(snapshot);
        setValue(previousDraft);
        return false;
      }
      return true;
    } catch {
      restoreAttachments(snapshot);
      setValue(previousDraft);
      return false;
    }
  };

  const onTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const onTextareaPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const immediateFiles = extractClipboardFiles(event.clipboardData);
    if (immediateFiles.length > 0) {
      event.preventDefault();
      void addComputerFiles(immediateFiles);
      return;
    }

    void readClipboardFilesFallback().then((fallbackFiles) => {
      if (fallbackFiles.length === 0) return;
      void addComputerFiles(fallbackFiles);
    });
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!modelSupportsUpload || isGenerating) return;
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const target = event.relatedTarget as Node | null;
    if (target && event.currentTarget.contains(target)) return;
    setIsDragActive(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (!modelSupportsUpload || isGenerating) return;

    const dropped = Array.from(event.dataTransfer.files || []);
    if (dropped.length === 0) return;
    void handleDroppedFiles(dropped);
  };

  const hasInput = value.trim().length > 0 || attachments.length > 0;
  const sendDisabled = isGenerating || pendingUploads > 0;
  const currentModelLabel =
    availableModels.find((model) => model.id === selectedModel)?.label || selectedModel;

  return (
    <div className="w-full px-4 pt-2 pb-6">
      <div className="mx-auto max-w-3xl">
        <div
          className="transition-all duration-300 ease-in-out"
          style={{ maxWidth: isVoiceActive ? 420 : "100%", margin: "0 auto" }}
        >
          {isVoiceActive ? (
            <VoiceBar
              onSendMessage={sendMessage}
              onClose={() => setIsVoiceActive(false)}
              onFirstMessage={onFirstMessage}
            />
          ) : (
            <div className="space-y-2">
              <AttachmentStrip attachments={attachments} onRemove={removeAttachment} />

              {pendingUploads > 0 ? (
                <p className="status-pill-success w-fit rounded-full px-2.5 py-1 text-[11px] font-medium">
                  Uploading {pendingUploads} file{pendingUploads > 1 ? "s" : ""}...
                </p>
              ) : null}

              {attachError ? (
                <ThemedInlineError
                  className="w-fit"
                  error={normalizeUserFacingError(attachError, { surface: "upload" })}
                />
              ) : null}

              <div
                className={`ui-surface relative flex w-full items-center gap-2 rounded-2xl border px-4 py-2 transition-all duration-200 ease-out ${
                  isDragActive
                    ? "border-primary/45 bg-primary/8 shadow-[0_0_0_1px_rgb(139_99_255/40%),0_12px_30px_rgb(91_58_212/26%)]"
                    : "border-white/8"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isDragActive ? (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-dashed border-primary/45 bg-[rgb(92_53_229/14%)] text-xs font-semibold uppercase tracking-[0.14em] text-violet-100">
                    Drop files to attach
                  </div>
                ) : null}

                <div className="shrink-0">
                  <AttachFile
                    onUploadFromComputer={openComputerPicker}
                    onUploadFromDrive={openDrivePicker}
                    disabled={isGenerating}
                  />
                </div>

                <textarea
                  ref={textareaRef}
                  className="custom-scrollbar min-h-[32px] max-h-[160px] flex-1 resize-none overflow-y-auto border-none bg-transparent px-2 py-1 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:shadow-none"
                  rows={1}
                  placeholder="Ask anything..."
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={onTextareaKeyDown}
                  onPaste={onTextareaPaste}
                  aria-label="Chat message input"
                />

                <div className="relative shrink-0" ref={modelMenuRef}>
                  <button
                    onClick={() => setIsModelMenuOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#070910] px-2.5 py-1.5 text-xs text-white/72 transition-[background-color,color,border-color,box-shadow] hover:border-primary/30 hover:bg-[#070910] hover:text-white hover:shadow-[0_10px_20px_rgb(92_53_229/20%)]"
                    aria-label="Select AI model"
                    title={`Model: ${selectedModel}`}
                  >
                    {selectedModel.includes("cloud") ? (
                      <Cloud className="h-3.5 w-3.5" />
                    ) : selectedModel.toLowerCase().includes("gemini") ? (
                      <Sparkles className="h-3.5 w-3.5" />
                    ) : (
                      <Cpu className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden max-w-[250px] truncate sm:inline">{currentModelLabel}</span>
                    {isModelMenuOpen ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>

                  {isModelMenuOpen ? (
                    <div className="absolute right-0 bottom-full z-50 mb-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-[#070910] shadow-[0_18px_40px_rgb(0_0_0/50%)]">
                      <div className="border-b border-white/5 px-3 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Select Model</p>
                      </div>

                      {availableModels.map((model) => {
                        const isActive = model.id === selectedModel;
                        const isCloudModel = model.id.includes("cloud");
                        const isGeminiModel = model.id.toLowerCase().includes("gemini");

                        return (
                          <button
                            key={model.id}
                            onClick={() => {
                              setSelectedModel(model.id);
                              setIsModelMenuOpen(false);
                            }}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-[background-color,color,border-color,box-shadow] ${
                              isActive
                                ? "border border-primary/35 bg-primary/16 text-white shadow-[0_10px_20px_rgb(92_53_229/22%)]"
                                : "border border-transparent text-white/65 hover:border-primary/25 hover:bg-primary/10 hover:text-white/92"
                            }`}
                          >
                            {isCloudModel ? (
                              <Cloud className="h-4 w-4 shrink-0" />
                            ) : isGeminiModel ? (
                              <Sparkles className="h-4 w-4 shrink-0" />
                            ) : (
                              <Cpu className="h-4 w-4 shrink-0" />
                            )}

                            <div className="min-w-0">
                              <span className="block text-sm font-medium">{model.label}</span>
                              <span className="block text-[10px] text-white/30">{model.id}</span>
                            </div>

                            {isActive ? <Check className="ml-auto size-3.5 text-violet-200" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0">
                  {hasInput || isGenerating ? (
                    <SendStopButton
                      isGenerating={isGenerating}
                      isStopping={isStopping}
                      hasInput={hasInput}
                      sendDisabled={sendDisabled}
                      onSend={() => void handleSend()}
                      onStop={stopGeneration}
                    />
                  ) : (
                    <TextToSpeech onClick={() => setIsVoiceActive(true)} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleComputerFilesSelected}
          multiple
          aria-label="Upload files from computer"
          title="Upload files from computer"
        />

        <DrivePickerDialog
          open={isDriveDialogOpen}
          onOpenChange={setIsDriveDialogOpen}
          query={driveSearch}
          onQueryChange={setDriveSearch}
          files={driveFiles}
          isLoading={isLoadingDrive}
          onSelectFile={(file) => void addDriveAttachment(file)}
        />

        <DriveUploadSigninOverlay
          open={showDriveSigninOverlay}
          onOpenChange={setShowDriveSigninOverlay}
          onSignIn={() => void signInForDrivePicker()}
          isReady={isDriveSigninReady}
          isSigningIn={isDriveSigningIn}
          authError={driveSigninError}
        />
      </div>
    </div>
  );
};

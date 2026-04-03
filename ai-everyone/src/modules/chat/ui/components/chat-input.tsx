"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Cloud, Cpu, Sparkles } from "lucide-react";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { AttachFile } from "@/modules/home/ui/components/attach-file";
import { TextToSpeech } from "@/modules/home/ui/components/text-to-speech";
import { useChatAttachments } from "@/modules/chat/upload/use-chat-attachments";
import { AttachmentStrip } from "@/modules/chat/upload/components/attachment-strip";
import { DrivePickerDialog } from "@/modules/chat/upload/components/drive-picker-dialog";
import { DriveUploadSigninOverlay } from "@/modules/chat/upload/components/drive-upload-signin-overlay";
import { SendStopButton } from "@/modules/chat/ui/components/send-stop-button";
import VoiceBar from "@/modules/chat/ui/components/VoiceBar";

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
        openDrivePicker,
        handleComputerFilesSelected,
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
            if (
                modelMenuRef.current &&
                !modelMenuRef.current.contains(event.target as Node)
            ) {
                setIsModelMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    const handleSend = async () => {
        const trimmed = value.trim();
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

        setValue("");
        onFirstMessage?.();
        const snapshot = [...attachments];
        clearAttachments();

        const content = trimmed || "Please analyze the attached file.";
        const result = await sendMessage(content, false, readyAttachments, failedAttachments);
        if (!result) {
            restoreAttachments(snapshot);
        }
    };

    const onTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleSend();
        }
    };

    const hasInput = value.trim().length > 0 || attachments.length > 0;
    const sendDisabled = isGenerating || pendingUploads > 0;
    const currentModelLabel =
        availableModels.find((model) => model.id === selectedModel)?.label || selectedModel;

    return (
        <div className="w-full px-4 pb-6 pt-2">
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

                            {pendingUploads > 0 && (
                                <p className="px-1 text-xs text-cyan-300">
                                    Uploading {pendingUploads} file{pendingUploads > 1 ? "s" : ""}...
                                </p>
                            )}
                            {attachError && <p className="px-1 text-xs text-red-400">{attachError}</p>}

                            <div
                                className="flex w-full items-center gap-2 rounded-2xl border border-white/5 px-4 py-2 transition-all duration-300 ease-in-out"
                                style={{ backgroundColor: "#0C0D0D" }}
                            >
                                <div className="shrink-0">
                                    <AttachFile
                                        onUploadFromComputer={openComputerPicker}
                                        onUploadFromDrive={openDrivePicker}
                                        disabled={isGenerating}
                                    />
                                </div>

                                <textarea
                                    ref={textareaRef}
                                    className="min-h-[32px] flex-1 resize-none overflow-hidden border-none bg-transparent px-2 py-1 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground"
                                    rows={1}
                                    placeholder="Ask anything..."
                                    value={value}
                                    onChange={(event) => setValue(event.target.value)}
                                    onKeyDown={onTextareaKeyDown}
                                    aria-label="Chat message input"
                                />

                                <div className="relative shrink-0" ref={modelMenuRef}>
                                    <button
                                        onClick={() => setIsModelMenuOpen((prev) => !prev)}
                                        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
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
                                        <span className="hidden max-w-[120px] truncate sm:inline">
                                            {currentModelLabel}
                                        </span>
                                        {isModelMenuOpen ? (
                                            <ChevronUp className="h-3 w-3" />
                                        ) : (
                                            <ChevronDown className="h-3 w-3" />
                                        )}
                                    </button>

                                    {isModelMenuOpen && (
                                        <div
                                            className="absolute bottom-full right-0 z-50 mb-2 w-56 overflow-hidden rounded-xl border border-white/10 shadow-xl"
                                            style={{ backgroundColor: "#1A1B1E" }}
                                        >
                                            <div className="border-b border-white/5 px-3 py-2">
                                                <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                                                    Select Model
                                                </p>
                                            </div>
                                            {availableModels.map((model) => {
                                                const isActive = model.id === selectedModel;
                                                const isCloudModel = model.id.includes("cloud");
                                                const isGeminiModel = model.id
                                                    .toLowerCase()
                                                    .includes("gemini");

                                                return (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => {
                                                            setSelectedModel(model.id);
                                                            setIsModelMenuOpen(false);
                                                        }}
                                                        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                                                            isActive
                                                                ? "bg-white/10 text-white"
                                                                : "text-white/60 hover:bg-white/5 hover:text-white/90"
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
                                                            <span className="block truncate text-sm font-medium">
                                                                {model.label}
                                                            </span>
                                                            <span className="block truncate text-[10px] text-white/30">
                                                                {model.id}
                                                            </span>
                                                        </div>
                                                        {isActive && (
                                                            <span className="ml-auto text-xs text-emerald-400">
                                                                ✓
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
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

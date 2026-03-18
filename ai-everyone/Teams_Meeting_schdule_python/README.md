# AI Teams Meeting Scheduler

A CLI assistant that schedules Microsoft Teams meetings through natural conversation using your local Ollama model `gemma3:4b`.

## Features

- Natural language scheduling for meeting details
- Voice input from the microphone in the CLI
- Spoken assistant replies in the CLI session
- Local LLM via Ollama instead of Anthropic
- Automatic Outlook contact/address-book lookup for attendee names
- Interactive disambiguation when Outlook finds multiple people with the same name
- Outlook calendar conflict detection before opening the meeting invite
- Microsoft Teams deep link with pre-filled subject, attendees, time, and description
- Outlook Web fallback with online meeting enabled
- Clipboard copy for the Teams link
- Multiple meetings in one session

## Setup

```bash
# 1. Install Python dependency
pip install -r requirements.txt

# 2. Make sure Ollama is running and the model exists
ollama pull gemma3:4b
ollama serve

# 3. Run the app
python main.py
```

If Ollama is already running as a background service on Windows, you only need `ollama pull gemma3:4b` once.

## Voice Mode

This project uses the built-in Windows `System.Speech` APIs, so there is no extra Python speech package to install.

Commands:

- `/voice on` enables microphone input plus spoken assistant replies
- `/voice off` disables voice mode and goes back to typed-only chat
- `/listen` captures one spoken utterance without enabling full voice mode

When voice mode is on:

- type `/voice on`
- press Enter on an empty prompt to speak
- the assistant still prints in the terminal and also speaks the same reply aloud

## Example

```text
You: /voice on
Assistant: Voice mode enabled. Press Enter on an empty prompt to speak.

You (press Enter)
Listening...
You (heard): Schedule a sprint planning meeting next Monday at 10am for 1 hour

Assistant: Sure. Who should attend?
```

## How It Works

1. The Ollama model gathers meeting details conversationally.
2. After confirmation, it emits structured meeting JSON inside `<MEETING_DATA>` tags.
3. If attendees were given as names, the app looks them up in your signed-in Outlook profile and address books.
4. If more than one person matches a name such as `Nandini`, the CLI asks you which one you mean.
5. If Outlook cannot find a person, the CLI asks for a fuller name or direct email instead of continuing with an empty attendee list.
6. Before opening Teams or Outlook, the app checks your Outlook calendar for overlapping meetings.
7. If the time is already busy, it shows the conflicting meeting and asks for a new slot.
8. The app converts the resolved attendee list into a Microsoft Teams deep link or Outlook compose link.
9. In voice mode, Windows speech recognition captures your utterance and Windows speech synthesis reads the assistant reply aloud.
10. You open the link and send the invite.

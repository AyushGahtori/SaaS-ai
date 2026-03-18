"""
AI-Powered Microsoft Teams Meeting Scheduler
Uses Ollama-hosted Gemma 3 for natural language scheduling and Teams deep link integration.
"""

import json
import re
import subprocess
import sys
import webbrowser
from datetime import datetime, timedelta
from urllib import error, request
from urllib.parse import quote

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
OLLAMA_MODEL = "qwen3.5:397b-cloud"
VOICE_TIMEOUT_SECONDS = 15
EMAIL_PATTERN = re.compile(r"[\w.\-+%]+@[\w.\-]+\.[A-Za-z]{2,}")

SYSTEM_PROMPT = f"""You are an intelligent scheduling assistant that helps users schedule Microsoft Teams meetings.

Your job is to:
1. Gather meeting details through natural conversation: title, date, time, duration, attendees, description or agenda.
2. Confirm all details with the user before finalizing.
3. When all details are confirmed by the user, output only a JSON object wrapped in <MEETING_DATA> tags:

<MEETING_DATA>
{{
  "title": "Meeting Title",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "duration": 60,
  "attendees": ["Navin", "priya@company.com"],
  "description": "Meeting agenda or description",
  "confirmed": true
}}
</MEETING_DATA>

Rules:
- Be conversational, warm, and professional.
- Accept attendee names, emails, or a mix of both.
- Do not ask the user for email addresses if they already gave attendee names; the app will try to resolve them from Outlook.
- Duration should be in minutes. Default to 30 or 60 if the user does not specify it.
- If the user gives vague dates like "next Monday", calculate the actual date.
- Today is {datetime.now().strftime("%A, %B %d, %Y")}.
- Only set confirmed: true after the user explicitly confirms the summary.
- Business hours are 09:00-18:00; suggest times within that range.
- Keep attendee values exactly as the user refers to them unless they explicitly give an email address.
"""


def stream_ollama(messages: list[dict]) -> str:
    """Stream chat output from a local Ollama server."""
    payload = {
        "model": OLLAMA_MODEL,
        "stream": True,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *messages],
    }
    req = request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    full_response = ""
    try:
        with request.urlopen(req, timeout=300) as response:
            for raw_line in response:
                line = raw_line.decode("utf-8").strip()
                if not line:
                    continue

                chunk = json.loads(line)
                if "error" in chunk:
                    raise RuntimeError(chunk["error"])

                text = chunk.get("message", {}).get("content", "")
                if text:
                    full_response += text
                    clean = strip_tags(full_response)
                    sys.stdout.write("\rAssistant: " + clean)
                    sys.stdout.flush()

                if chunk.get("done"):
                    break
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(
            f"Ollama returned HTTP {exc.code}. Make sure model '{OLLAMA_MODEL}' is available. {details}".strip()
        ) from exc
    except error.URLError as exc:
        raise RuntimeError(
            f"Could not reach Ollama at {OLLAMA_URL}. Start Ollama and install model '{OLLAMA_MODEL}'."
        ) from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError("Received an invalid streaming response from Ollama.") from exc

    return full_response


def extract_meeting(text: str) -> dict | None:
    match = re.search(r"<MEETING_DATA>(.*?)</MEETING_DATA>", text, re.DOTALL)
    if not match:
        return None

    try:
        return json.loads(match.group(1).strip())
    except json.JSONDecodeError:
        return None


def strip_tags(text: str) -> str:
    return re.sub(r"<MEETING_DATA>.*?</MEETING_DATA>", "", text, flags=re.DOTALL).strip()


def run_powershell(script: str, stdin_text: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["powershell", "-NoProfile", "-Command", script],
        input=stdin_text,
        capture_output=True,
        text=True,
        check=False,
    )


def extract_email(text: str) -> str | None:
    match = EMAIL_PATTERN.search(text or "")
    return match.group(0) if match else None


def cleanup_attendee_query(value: str) -> str:
    cleaned = (value or "").strip()
    cleaned = re.sub(r"\s*<[^>]+>\s*", " ", cleaned)
    cleaned = re.sub(r"'s\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"[^\w\s.\-]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def normalize_attendees(attendees: object) -> list[str]:
    if attendees is None:
        return []
    if isinstance(attendees, str):
        values = [attendees]
    elif isinstance(attendees, list):
        values = [str(item) for item in attendees if str(item).strip()]
    else:
        values = [str(attendees)]
    return [value.strip() for value in values if value.strip()]


def search_outlook_people(query: str) -> list[dict]:
    script = r"""
$query = [Console]::In.ReadToEnd().Trim()
if (-not $query) {
    '[]'
    exit 0
}

function Get-SmtpAddress($entry) {
    if ($null -eq $entry) {
        return $null
    }
    try {
        $smtp = $entry.PropertyAccessor.GetProperty("http://schemas.microsoft.com/mapi/proptag/0x39FE001E")
        if ($smtp) {
            return $smtp
        }
    } catch {}
    try {
        $exchangeUser = $entry.GetExchangeUser()
        if ($exchangeUser -and $exchangeUser.PrimarySmtpAddress) {
            return $exchangeUser.PrimarySmtpAddress
        }
    } catch {}
    try {
        if ($entry.Address) {
            return $entry.Address
        }
    } catch {}
    return $null
}

function MatchesQuery([string]$name, [string]$email, [string[]]$tokens) {
    if ($null -eq $name) {
        $name = ''
    }
    if ($null -eq $email) {
        $email = ''
    }
    $haystack = ($name + ' ' + $email).ToLowerInvariant()
    foreach ($token in $tokens) {
        if (-not $haystack.Contains($token)) {
            return $false
        }
    }
    return $true
}

function Add-Candidate($results, $seen, [string]$name, [string]$email, [string]$source) {
    if ([string]::IsNullOrWhiteSpace($email)) {
        return
    }
    $key = $email.Trim().ToLowerInvariant()
    if ($seen.ContainsKey($key)) {
        return
    }
    $seen[$key] = $true
    $results.Add([pscustomobject]@{
        name = $name
        email = $email
        source = $source
    })
}

try {
    $tokens = $query.ToLowerInvariant().Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)
    $app = New-Object -ComObject Outlook.Application
    $namespace = $app.GetNamespace('MAPI')
    $results = New-Object System.Collections.Generic.List[object]
    $seen = @{}

    try {
        $recipient = $namespace.CreateRecipient($query)
        $recipient.Resolve()
        if ($recipient.Resolved) {
            $entry = $recipient.AddressEntry
            $resolvedName = $recipient.Name
            $resolvedEmail = Get-SmtpAddress $entry
            if (-not $resolvedEmail -and $recipient.Address) {
                $resolvedEmail = $recipient.Address
            }
            Add-Candidate $results $seen $resolvedName $resolvedEmail 'Resolved Recipient'
        }
    } catch {}

    try {
        $contacts = $namespace.GetDefaultFolder(10).Items
        foreach ($item in $contacts) {
            try {
                $name = $item.FullName
                if (-not $name) {
                    $name = $item.CompanyName
                }
                $emails = @($item.Email1Address, $item.Email2Address, $item.Email3Address) | Where-Object { $_ }
                foreach ($email in $emails) {
                    if (MatchesQuery $name $email $tokens) {
                        Add-Candidate $results $seen $name $email 'Contacts'
                    }
                }
            } catch {}
            if ($results.Count -ge 15) {
                break
            }
        }
    } catch {}

    if ($results.Count -lt 15) {
        foreach ($addressList in $namespace.AddressLists) {
            try {
                foreach ($entry in $addressList.AddressEntries) {
                    try {
                        $name = $entry.Name
                        $email = Get-SmtpAddress $entry
                        if (MatchesQuery $name $email $tokens) {
                            Add-Candidate $results $seen $name $email $addressList.Name
                        }
                    } catch {}
                    if ($results.Count -ge 15) {
                        break
                    }
                }
            } catch {}
            if ($results.Count -ge 15) {
                break
            }
        }
    }

    $results | ConvertTo-Json -Compress
} catch {
    Write-Error $_
    exit 1
}
"""
    result = run_powershell(script, stdin_text=query)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Outlook contact search failed.")

    output = result.stdout.strip()
    if not output:
        return []

    parsed = json.loads(output)
    candidates = parsed if isinstance(parsed, list) else [parsed]
    lowered_query = query.strip().lower()

    def rank(candidate: dict) -> tuple[int, str, str]:
        name = str(candidate.get("name", "")).strip().lower()
        email = str(candidate.get("email", "")).strip().lower()
        exact = name == lowered_query or email == lowered_query
        starts = name.startswith(lowered_query)
        return (0 if exact else 1, 0 if starts else 1, name)

    return sorted(candidates, key=rank)


def choose_outlook_match(name: str, matches: list[dict]) -> dict | None:
    if not matches:
        return None
    if len(matches) == 1:
        return matches[0]

    print(f"\nI found multiple Outlook matches for '{name}':\n")
    for index, match in enumerate(matches, start=1):
        label = match.get("name") or match.get("email") or "Unknown"
        email = match.get("email", "")
        source = match.get("source", "Outlook")
        print(f"  [{index}] {label} <{email}> ({source})")
    print("  [S] Skip this attendee")
    print("")

    while True:
        choice = input(f"Choose the right match for '{name}': ").strip().lower()
        if choice in {"s", "skip"}:
            return None
        if choice.isdigit():
            selected = int(choice)
            if 1 <= selected <= len(matches):
                return matches[selected - 1]
        print("Please enter a valid number or S to skip.")


def resolve_meeting_attendees(meeting: dict) -> tuple[dict, list[str]]:
    updated = dict(meeting)
    original_attendees = normalize_attendees(meeting.get("attendees"))
    resolved_attendees: list[str] = []
    attendee_labels: list[str] = []
    unresolved: list[str] = []

    for attendee in original_attendees:
        direct_email = extract_email(attendee)
        if direct_email:
            resolved_attendees.append(direct_email)
            attendee_labels.append(attendee)
            continue

        lookup_query = cleanup_attendee_query(attendee)
        if not lookup_query:
            unresolved.append(attendee)
            continue

        try:
            matches = search_outlook_people(lookup_query)
        except RuntimeError as exc:
            print(f"\nOutlook lookup error for '{attendee}': {exc}")
            unresolved.append(attendee)
            continue

        chosen = choose_outlook_match(attendee, matches)
        if not chosen:
            unresolved.append(attendee)
            continue

        email = str(chosen.get("email", "")).strip()
        display_name = str(chosen.get("name", "")).strip() or attendee
        resolved_attendees.append(email)
        attendee_labels.append(f"{display_name} <{email}>")

    updated["attendees"] = resolved_attendees
    updated["attendee_labels"] = attendee_labels or original_attendees
    return updated, unresolved


def prompt_to_fix_unresolved_attendees(meeting: dict, unresolved: list[str]) -> tuple[dict, list[str]]:
    current = dict(meeting)
    pending = list(unresolved)

    while pending:
        unresolved_name = pending.pop(0)
        replacement = input(
            f"Could not find '{unresolved_name}'. Enter a fuller name/email, or S to skip: "
        ).strip()
        if not replacement or replacement.lower() in {"s", "skip"}:
            continue

        current_attendees = normalize_attendees(current.get("attendees"))
        current_labels = list(current.get("attendee_labels", current_attendees))

        direct_email = extract_email(replacement)
        if direct_email:
            current_attendees.append(direct_email)
            current_labels.append(replacement)
            current["attendees"] = current_attendees
            current["attendee_labels"] = current_labels
            continue

        lookup_query = cleanup_attendee_query(replacement)
        if not lookup_query:
            pending.append(unresolved_name)
            continue

        try:
            matches = search_outlook_people(lookup_query)
        except RuntimeError as exc:
            print(f"\nOutlook lookup error for '{replacement}': {exc}")
            pending.append(unresolved_name)
            continue

        chosen = choose_outlook_match(replacement, matches)
        if not chosen:
            pending.append(unresolved_name)
            continue

        email = str(chosen.get("email", "")).strip()
        display_name = str(chosen.get("name", "")).strip() or replacement
        current_attendees.append(email)
        current_labels.append(f"{display_name} <{email}>")
        current["attendees"] = current_attendees
        current["attendee_labels"] = current_labels

    return current, pending


def get_meeting_window(meeting: dict) -> tuple[datetime, datetime]:
    start_dt = datetime.strptime(f"{meeting['date']} {meeting['time']}", "%Y-%m-%d %H:%M")
    end_dt = start_dt + timedelta(minutes=int(meeting.get("duration", 60)))
    return start_dt, end_dt


def search_calendar_conflicts(meeting: dict) -> list[dict]:
    start_dt, end_dt = get_meeting_window(meeting)
    payload = json.dumps(
        {
            "start": start_dt.strftime("%Y-%m-%d %H:%M"),
            "end": end_dt.strftime("%Y-%m-%d %H:%M"),
        }
    )
    script = r"""
$payload = [Console]::In.ReadToEnd()
if (-not $payload) {
    '[]'
    exit 0
}

try {
    $request = $payload | ConvertFrom-Json
    $windowStart = [datetime]::ParseExact($request.start, 'yyyy-MM-dd HH:mm', $null)
    $windowEnd = [datetime]::ParseExact($request.end, 'yyyy-MM-dd HH:mm', $null)

    $app = New-Object -ComObject Outlook.Application
    $namespace = $app.GetNamespace('MAPI')
    $calendar = $namespace.GetDefaultFolder(9)
    $items = $calendar.Items
    $items.Sort('[Start]')
    $items.IncludeRecurrences = $true

    $conflicts = New-Object System.Collections.Generic.List[object]

    foreach ($item in $items) {
        try {
            $busyStatus = 0
            try {
                $busyStatus = [int]$item.BusyStatus
            } catch {}
            if ($busyStatus -eq 0) {
                continue
            }

            $itemStart = [datetime]$item.Start
            $itemEnd = [datetime]$item.End
            if ($itemStart -lt $windowEnd -and $itemEnd -gt $windowStart) {
                $conflicts.Add([pscustomobject]@{
                    subject = $item.Subject
                    start = $itemStart.ToString('yyyy-MM-dd HH:mm')
                    end = $itemEnd.ToString('yyyy-MM-dd HH:mm')
                    location = $item.Location
                    organizer = $item.Organizer
                    busy_status = $busyStatus
                })
            }
        } catch {}
    }

    $conflicts | Select-Object -Unique subject, start, end, location, organizer, busy_status | ConvertTo-Json -Compress
} catch {
    Write-Error $_
    exit 1
}
"""
    result = run_powershell(script, stdin_text=payload)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Outlook calendar lookup failed.")

    output = result.stdout.strip()
    if not output:
        return []

    parsed = json.loads(output)
    conflicts = parsed if isinstance(parsed, list) else [parsed]
    return sorted(conflicts, key=lambda item: (item.get("start", ""), item.get("subject", "")))


def print_calendar_conflicts(conflicts: list[dict]) -> None:
    print("\nThat time conflicts with your Outlook calendar:\n")
    for index, conflict in enumerate(conflicts, start=1):
        start_text = conflict.get("start", "")
        end_text = conflict.get("end", "")
        subject = conflict.get("subject") or "Busy"
        organizer = conflict.get("organizer") or "Unknown organizer"
        location = conflict.get("location") or "No location"
        print(f"  [{index}] {subject}")
        print(f"      {start_text} -> {end_text}")
        print(f"      Organizer: {organizer} | Location: {location}")
    print("")


def prompt_for_new_schedule(meeting: dict) -> dict | None:
    updated = dict(meeting)
    while True:
        user_value = input(
            "Enter a new slot as YYYY-MM-DD HH:MM, or type S to skip this meeting: "
        ).strip()
        if not user_value:
            continue
        if user_value.lower() in {"s", "skip", "q", "quit"}:
            return None
        try:
            new_start = datetime.strptime(user_value, "%Y-%m-%d %H:%M")
        except ValueError:
            print("Please enter the date and time exactly like 2026-03-12 15:30.")
            continue

        updated["date"] = new_start.strftime("%Y-%m-%d")
        updated["time"] = new_start.strftime("%H:%M")
        return updated


def ensure_free_timeslot(meeting: dict) -> dict | None:
    current = dict(meeting)
    while True:
        try:
            conflicts = search_calendar_conflicts(current)
        except RuntimeError as exc:
            print(f"\nCalendar lookup error: {exc}\n")
            return current

        if not conflicts:
            return current

        print_calendar_conflicts(conflicts)
        current = prompt_for_new_schedule(current)
        if current is None:
            print("\nSkipped scheduling this meeting because the selected time was busy.\n")
            return None


def speak_text(text: str) -> None:
    """Speak text aloud using the Windows speech synthesizer."""
    clean_text = strip_tags(text).strip()
    if not clean_text:
        return

    script = """
Add-Type -AssemblyName System.Speech
$text = [Console]::In.ReadToEnd()
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Speak($text)
"""
    result = run_powershell(script, stdin_text=clean_text)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Speech synthesis failed.")


def listen_for_speech(timeout_seconds: int = VOICE_TIMEOUT_SECONDS) -> str:
    """Capture one utterance from the default microphone using Windows dictation."""
    script = f"""
Add-Type -AssemblyName System.Speech
$recognizers = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
if (-not $recognizers -or $recognizers.Count -eq 0) {{
    Write-Error 'No Windows speech recognizer is installed.'
    exit 1
}}
$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine($recognizers[0].Culture)
$recognizer.SetInputToDefaultAudioDevice()
$recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$result = $recognizer.Recognize([TimeSpan]::FromSeconds({timeout_seconds}))
if ($result -and $result.Text) {{
    [Console]::Write($result.Text)
}}
"""
    result = run_powershell(script)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Speech recognition failed.")
    return result.stdout.strip()


def build_teams_url(meeting: dict) -> str:
    """Build a Microsoft Teams deep-link URL to pre-fill a meeting."""
    start_dt, end_dt = get_meeting_window(meeting)

    subject = quote(meeting.get("title", "Team Meeting"))
    attendees = quote(",".join(meeting.get("attendees", [])))
    content = quote(meeting.get("description", ""))
    start_time = quote(start_dt.strftime("%Y-%m-%dT%H:%M:%S"))
    end_time = quote(end_dt.strftime("%Y-%m-%dT%H:%M:%S"))

    return (
        f"https://teams.microsoft.com/l/meeting/new?"
        f"subject={subject}"
        f"&attendees={attendees}"
        f"&content={content}"
        f"&startTime={start_time}"
        f"&endTime={end_time}"
    )


def build_outlook_teams_url(meeting: dict) -> str:
    """Fallback: Outlook Web new event with Teams meeting enabled."""
    start_dt, end_dt = get_meeting_window(meeting)

    subject = quote(meeting.get("title", "Team Meeting"))
    attendees = quote(";".join(meeting.get("attendees", [])))
    body = quote(meeting.get("description", ""))
    start = quote(start_dt.strftime("%Y-%m-%dT%H:%M:%S"))
    end = quote(end_dt.strftime("%Y-%m-%dT%H:%M:%S"))

    return (
        f"https://outlook.office.com/calendar/action/compose?"
        f"subject={subject}&to={attendees}&body={body}"
        f"&startdt={start}&enddt={end}&isonlinemeeting=true"
    )


def format_summary(meeting: dict) -> str:
    """Pretty-print the captured meeting details."""
    start_dt, end_dt = get_meeting_window(meeting)

    summary_attendees = meeting.get("attendee_labels") or meeting.get("attendees") or ["(none)"]
    attendees = "\n       ".join(summary_attendees)
    lines = [
        "",
        "=" * 50,
        f"  {meeting.get('title', 'Meeting')}",
        "=" * 50,
        f"  Date: {start_dt.strftime('%A, %B %d, %Y')}",
        f"  Time: {start_dt.strftime('%I:%M %p')} -> {end_dt.strftime('%I:%M %p')} ({meeting.get('duration', 60)} min)",
        "  Attendees:",
        f"       {attendees}",
    ]
    if meeting.get("description"):
        lines.append(f"  Notes: {meeting['description']}")
    lines.append("")
    return "\n".join(lines)


def print_ai(text: str) -> None:
    print(f"\nAssistant: {text}\n")


def print_user_prompt(voice_mode: bool) -> str:
    prompt = "You (Enter=speak, or type): " if voice_mode else "You: "
    return input(prompt).strip()


def handle_choice(choice: str, teams_url: str, outlook_url: str) -> None:
    if choice == "1":
        webbrowser.open(teams_url)
        print("\n  Opening Microsoft Teams in your browser...\n")
    elif choice == "2":
        webbrowser.open(outlook_url)
        print("\n  Opening Outlook Web in your browser...\n")
    elif choice == "3":
        try:
            import pyperclip

            pyperclip.copy(teams_url)
            print("\n  Teams link copied to clipboard.\n")
        except ImportError:
            print(f"\n  Teams URL:\n  {teams_url}\n")


def chat() -> None:
    print("\n" + "=" * 50)
    print("   Microsoft Teams Meeting Scheduler")
    print(f"   Powered by Ollama ({OLLAMA_MODEL}) | Type 'exit' to quit")
    print("   Commands: /voice on, /voice off, /listen")
    print("=" * 50)

    messages: list[dict] = []
    voice_mode = False

    greeting = (
        "Hi. I can help you schedule a Microsoft Teams meeting.\n"
        "Tell me the meeting topic, attendees, and when you want it to happen."
    )
    print_ai(greeting)

    while True:
        try:
            user_input = print_user_prompt(voice_mode)
            if voice_mode and not user_input:
                print("Listening...")
                user_input = listen_for_speech()
                if user_input:
                    print(f"You (heard): {user_input}")
        except (KeyboardInterrupt, EOFError):
            print("\n\nGoodbye!\n")
            sys.exit(0)
        except RuntimeError as exc:
            print(f"\nVoice error: {exc}\n")
            continue

        normalized = user_input.lower()
        if normalized in {"exit", "quit", "q", "bye"}:
            print("\nGoodbye!\n")
            break
        if normalized == "/voice on":
            voice_mode = True
            print("\nVoice mode enabled. Press Enter on an empty prompt to speak.\n")
            try:
                speak_text("Voice mode enabled. Press Enter on an empty prompt to speak.")
            except RuntimeError as exc:
                print(f"Voice output error: {exc}")
            continue
        if normalized == "/voice off":
            voice_mode = False
            print("\nVoice mode disabled.\n")
            continue
        if normalized == "/listen":
            try:
                print("Listening...")
                user_input = listen_for_speech()
                if user_input:
                    print(f"You (heard): {user_input}")
                else:
                    print("\nI did not catch anything. Try again.\n")
                    continue
            except RuntimeError as exc:
                print(f"\nVoice error: {exc}\n")
                continue

        if not user_input:
            continue

        messages.append({"role": "user", "content": user_input})

        print("\nAssistant: ", end="", flush=True)
        try:
            full_response = stream_ollama(messages)
        except RuntimeError as exc:
            print(f"\n\nError: {exc}\n")
            continue

        print("\n")
        messages.append({"role": "assistant", "content": full_response})

        response_text = strip_tags(full_response)
        if voice_mode:
            try:
                speak_text(response_text)
            except RuntimeError as exc:
                print(f"Voice output error: {exc}")

        meeting = extract_meeting(full_response)
        if meeting and meeting.get("confirmed"):
            meeting, unresolved = resolve_meeting_attendees(meeting)
            if unresolved:
                print(
                    "\nI could not resolve these attendees from Outlook: "
                    + ", ".join(unresolved)
                    + ".\n"
                )
                meeting, unresolved = prompt_to_fix_unresolved_attendees(meeting, unresolved)
                if unresolved:
                    print(
                        "\nStill unresolved: "
                        + ", ".join(unresolved)
                        + ".\n"
                    )
                if not normalize_attendees(meeting.get("attendees")):
                    print("No attendees were resolved, so this meeting was not scheduled.\n")
                    messages = []
                    continue
            meeting = ensure_free_timeslot(meeting)
            if meeting is None:
                messages = []
                continue
            print(format_summary(meeting))

            teams_url = build_teams_url(meeting)
            outlook_url = build_outlook_teams_url(meeting)

            print("  Meeting details captured. Open in:\n")
            print(f"  [1] Microsoft Teams  ->  {teams_url[:60]}...")
            print(f"  [2] Outlook Web      ->  {outlook_url[:60]}...")
            print("  [3] Copy Teams link to clipboard")
            print("  [Q] Skip / Schedule another\n")

            choice = input("  Choose [1/2/3/Q]: ").strip().lower()
            handle_choice(choice, teams_url, outlook_url)

            print("  Describe another meeting to keep going.\n")
            messages = []

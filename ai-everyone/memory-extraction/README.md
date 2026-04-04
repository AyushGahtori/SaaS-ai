# Memory Extraction CLI

Standalone Python tool to test the 3-layer memory extraction pipeline.

## Setup

```bash
cd memory-extraction
pip install -r requirements.txt
```

Or inside Docker:

```bash
docker exec -it Pian bash
cd /app/memory-extraction
pip install -r requirements.txt
```

## Usage

```bash
# Basic extraction
python main.py --message "I am a developer working on React"

# With verbose layer output
python main.py --message "I am a developer working on React" --verbose

# Custom Ollama URL and model
python main.py --message "I prefer concise and step-by-step answers" \
  --ollama-url http://localhost:11434 \
  --model qwen2.5:7b
```

## Example outputs

**Layer 2 (rule-based) match:**
```bash
$ python main.py --message "I am a developer working on React" --verbose
[Layer1] trigger=YES
[Layer2] extracted 2 items
[
  {
    "key": "role",
    "value": "developer",
    "confidence": 0.95
  },
  {
    "key": "current_project",
    "value": "React",
    "confidence": 0.85
  }
]
```

**Layer 3 (LLM) escalation:**
```bash
$ python main.py --message "Lately I've been diving deep into frontend frameworks" --verbose
[Layer1] trigger=YES
[Layer2] extracted 0 items
[Layer2] no match, escalating to Layer 3 (LLM)...
[Layer3] LLM extracted 1 items
[
  {
    "key": "tech_stack",
    "value": "frontend frameworks",
    "confidence": 0.75
  }
]
```

**Non-trigger message:**
```bash
$ python main.py --message "What is React?"
[]
```

## Environment variables

Create a `.env` file (optional):
```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=qwen2.5:7b
```

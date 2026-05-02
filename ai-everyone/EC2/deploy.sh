#!/usr/bin/env bash
set -euo pipefail

EC2_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="${EC2_ROOT}/venv"

python3 -m venv "${VENV}"
"${VENV}/bin/pip" install --upgrade pip

for req in "${EC2_ROOT}"/agents/*/requirements.txt; do
  echo "Installing ${req}"
  "${VENV}/bin/pip" install -r "${req}"
done

echo "Install service files from ${EC2_ROOT}/systemd manually or with your infra tool."
echo "Install nginx snippets from ${EC2_ROOT}/nginx manually or with your infra tool."
echo "No SSH or remote mutation is performed by this script."

"""Small cross-platform launcher. No shell activation or global Python packages required."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import venv

ROOT = Path(__file__).resolve().parent
PYTHON = ROOT / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')


def run(args):
    subprocess.run([str(a) for a in args], cwd=ROOT, check=True)


def main():
    parser = argparse.ArgumentParser(description='Launch AI Business Tycoon locally')
    parser.add_argument('--setup', action='store_true', help='Install pinned dependencies and build the client first')
    parser.add_argument('--host', default='127.0.0.1',
                        help='Bind address; use 0.0.0.0 for a managed cloud preview')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    if sys.version_info < (3, 11):
        parser.error('Install Python 3.11 or newer.')
    if args.setup:
        npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
        if not npm:
            parser.error('Install Node.js 22.12+ LTS, then reopen VS Code so npm is on PATH.')
        if not PYTHON.exists():
            venv.create(ROOT / '.venv', with_pip=True)
        run([PYTHON, '-m', 'pip', 'install', '-r', 'requirements.txt'])
        run([npm, 'ci', '--no-fund', '--no-audit'])
        run([npm, 'run', 'build'])
    if not PYTHON.exists() or not (ROOT / 'dist' / 'index.html').exists():
        parser.error('First run: python run.py --setup')
    location = (f'Open http://127.0.0.1:{args.port} in your browser.' if args.host == '127.0.0.1'
                else f'Listening on {args.host}:{args.port}. Use the managed preview for port {args.port}.')
    print(f'\nAI Business Tycoon · SIMULATION ONLY\n{location}\nCtrl+C stops the server.\n', flush=True)
    run([PYTHON, '-m', 'uvicorn', 'backend.app:app', '--host', args.host, '--port', str(args.port)])


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as exc:
        print(f'Step failed (exit {exc.returncode}). Read the output above, correct the problem and retry.', file=sys.stderr)
        sys.exit(exc.returncode)
    except KeyboardInterrupt:
        pass

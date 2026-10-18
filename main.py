"""Compatibility entry point: launch the complete prototype, not a welcome message."""
from pathlib import Path
import runpy


if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).with_name('run.py')), run_name='__main__')

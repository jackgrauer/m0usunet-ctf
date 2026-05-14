#!/usr/bin/env python3
"""wrap — ANSI-aware word-wrap with paragraph reflow.

Reads stdin, word-wraps to $COLUMNS (or arg), writes to stdout.
ANSI escapes are emitted unchanged but ignored for column-count
purposes. Consecutive non-empty lines are treated as one paragraph
and re-flowed, so the source can keep its human-readable line
breaks. Empty lines separate paragraphs and pass through.

Lines that look like ASCII art / headers (no spaces, or contain
heavy box-drawing chars) skip reflow.

Used by the portal and game-shell scripts so long narrative
blocks break at word boundaries on narrow viewports.
"""

import os
import re
import sys

ANSI = re.compile(r'\x1b\[[0-9;]*[A-Za-z]')
BOX_CHARS = set('═║╔╗╚╝╠╣╦╩╬─│┌┐└┘├┤┬┴┼━┃┏┓┗┛┣┫┳┻╋')
# A run of 2+ spaces between non-space tokens means the source is using
# whitespace for column alignment (a command + its description, a list
# row, etc.). Prose never does this — single spaces between words only.
TABLE_LIKE = re.compile(r'\S {2,}\S')


def visible_len(s):
    return len(ANSI.sub('', s))


def looks_like_art(line):
    stripped = ANSI.sub('', line)
    if any(c in BOX_CHARS for c in stripped):
        return True
    # Aligned-column rows ("  cmd        description") — preserve.
    if TABLE_LIKE.search(stripped):
        return True
    return False


def wrap_paragraph(text, width, indent=''):
    parts = re.split(r'(\s+)', text)
    out_lines = []
    cur = indent
    cur_w = len(indent)
    pending = ''
    for p in parts:
        if not p:
            continue
        if p.isspace():
            pending = ' '
            continue
        pw = visible_len(p)
        if cur_w + len(pending) + pw > width and cur.strip():
            out_lines.append(cur.rstrip())
            cur = indent + p
            cur_w = len(indent) + pw
            pending = ''
        else:
            cur += pending + p
            cur_w += len(pending) + pw
            pending = ''
    if cur.strip():
        out_lines.append(cur.rstrip())
    return out_lines


def detect_indent(line):
    i = 0
    while i < len(line) and line[i] in ' \t':
        i += 1
    return line[:i]


def reflow(lines, width):
    """Group consecutive non-art, non-empty lines into paragraphs."""
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            out.append('')
            i += 1
            continue
        if looks_like_art(line):
            out.append(line)
            i += 1
            continue
        # Collect the paragraph: this line and any following non-empty,
        # non-art lines whose indent matches.
        indent = detect_indent(line)
        para_lines = [line.lstrip(' \t')]
        j = i + 1
        while j < len(lines):
            nxt = lines[j]
            if not nxt.strip():
                break
            if looks_like_art(nxt):
                break
            if detect_indent(nxt) != indent:
                break
            para_lines.append(nxt.lstrip(' \t'))
            j += 1
        para = ' '.join(para_lines)
        out.extend(wrap_paragraph(para, width, indent))
        i = j
    return out


def main():
    if len(sys.argv) > 1:
        try:
            width = int(sys.argv[1])
        except ValueError:
            width = 80
    else:
        try:
            width = int(os.environ.get('COLUMNS', '0')) \
                or os.get_terminal_size().columns
        except (OSError, ValueError):
            width = 80
    width = max(20, min(width, 78))

    raw = sys.stdin.read().splitlines()
    for line in reflow(raw, width):
        print(line)


if __name__ == '__main__':
    main()

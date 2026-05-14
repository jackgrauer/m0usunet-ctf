# /etc/profile.d/qol.sh — quality-of-life defaults sourced by every
# interactive shell (login + portal + game subshell). Single source
# of truth used by both the VM build and the local devshell.

# ─── Terminal hygiene ────────────────────────────────────────────────
# Every typical v86-on-serial bug we've hit has a fix here. Keep this
# block short and explicit so future debugging knows where to look.

# 1. Match the page's xterm width. xterm.js is pinned to 80 cols; if
#    the VM disagrees, readline overwrites the prompt when the player
#    types past the shorter side. Pin both.
stty cols 80 rows 30 2>/dev/null || true
export COLUMNS=80
export LINES=30

# 2. Reset line-discipline to sane defaults. Recovers a wedged
#    terminal after a misbehaving binary leaves icanon/echo off.
stty sane 2>/dev/null || true

# 3. Backspace should erase. xterm.js sends 0x7F (DEL); make stty
#    treat that as the erase key (some defaults set it to ^H which
#    then prints "^?" instead of deleting).
stty erase '^?' 2>/dev/null || true

# 4. Don't echo control chars as ^X — when the player hits Ctrl-C
#    they shouldn't see "^C" leaking into the next line.
stty -echoctl 2>/dev/null || true

# 5. Tell bash to recheck COLUMNS/LINES after every command. If the
#    terminal does resize (it shouldn't — we pin — but belt and
#    braces), readline picks up the new size immediately instead of
#    drawing with stale dimensions.
[ -n "$BASH_VERSION" ] && shopt -s checkwinsize 2>/dev/null || true

# 6. Disable history expansion (`!`). The player's curl URLs and
#    exploit strings contain ! and `!!`; bash would try to expand
#    those into history references and either fail or replay random
#    commands. Off.
set +H 2>/dev/null || true

# 7. TERM advertises 256-color support so xterm-published colors
#    render correctly (no fallback to mono).
export TERM=xterm-256color

# ─── Aliases + pager ─────────────────────────────────────────────────

alias ls='ls --color=auto'
alias ll='ls -la --color=auto'
alias l='ls --color=auto'
alias grep='grep --color=auto'
alias ..='cd ..'
alias ...='cd ../..'

# Pager that preserves ANSI colors, exits if output fits one screen,
# and does not clobber the terminal on exit.
export PAGER='less -R'
export LESS='-RFX'

# Tab completion for filenames, flags, etc. The bash-completion
# package is loaded from /etc/profile.d/bash_completion.sh by default;
# this line only fires if a shell sources qol.sh before that runs.
if [ -r /etc/profile.d/bash_completion.sh ]; then
  . /etc/profile.d/bash_completion.sh 2>/dev/null || true
fi

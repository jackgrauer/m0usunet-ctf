# /etc/profile.d/qol.sh — quality-of-life defaults sourced by every
# interactive shell (login + portal + game subshell). Single source
# of truth used by both the VM build and the local devshell.

# Pin the terminal size to match xterm.js on the page (80 cols). If
# the VM and xterm disagree, readline redraws over the prompt when
# the player types past the shorter of the two widths. Both sides
# now stay at 80 cols.
stty cols 80 rows 30 2>/dev/null || true
export COLUMNS=80
export LINES=30
export TERM=xterm-256color

# Colors for common file/dir/search tools.
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

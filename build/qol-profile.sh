# /etc/profile.d/qol.sh — quality-of-life defaults sourced by every
# interactive shell (login + portal + game subshell). Single source
# of truth used by both the VM build and the local devshell.

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

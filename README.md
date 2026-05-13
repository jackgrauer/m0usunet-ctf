# m0usunet-ctf

A static-site, browser-native intuition exam for Junior Sniffer applicants at
Mouse Bites Inc. Real Alpine Linux running on each phone via [v86][v86]. Three
puzzles. Thirty minutes. No installs, no logins, no captive portal.

> **OPERATION: PARMESAN**
> Target: `crazy.ants`.
> Goal: enumerate, exploit, exfiltrate.
> Three stages. Tools: nmap, Burp, Metasploit.

[v86]: https://github.com/copy/v86

## Status

Day-1 scaffold. The site files are in place but `site/v86/` is empty and there
are no disk images yet, so the page will not boot a VM. See the build plan in
the design doc for what comes next.

## Layout

```
m0usunet-ctf/
├── site/             # static page served from GitHub Pages
│   ├── index.html
│   ├── boot.js       # v86 bootstrap
│   ├── keyboard.js   # on-screen helper bar
│   ├── nicks.js      # applicant alias generator
│   ├── style.css
│   ├── favicon.svg
│   ├── board.html
│   └── v86/          # populated by the deploy workflow
├── build/            # Alpine + kit disk builders (Linux box)
├── kit-content/      # puzzle materials baked into kit.img
├── scoreboard/       # Cloudflare Worker for the Hiring Board
└── .github/workflows/deploy.yml
```

## Local dev

The site is plain static HTML/CSS/JS. Serve it however you like:

```sh
cd site && python3 -m http.server 8000
# → http://localhost:8000
```

It will fail to boot v86 until you drop `libv86.js`, `v86.wasm`, `seabios.bin`,
`vgabios.bin`, `alpine.img`, and `kit.img` into `site/` (and `site/v86/`). The
deploy workflow does this automatically on push; locally you can grab v86 from
its CI release and skip disk images while iterating on the page chrome.

## Building the disks

Disk-image builds require a Linux host (loop mounts, `mkfs.ext2`,
`alpine-make-vm-image`). The `build/` directory is a placeholder for now.

## Deploying

GitHub Actions builds `site/v86/` from the upstream v86 release and publishes
`site/` to GitHub Pages. Disk image builds will be wired in once the build
scripts land.

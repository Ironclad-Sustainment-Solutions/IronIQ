# Security notes

Running log of security-relevant decisions that aren't self-explanatory
from the code alone -- mainly "why didn't we just fix this" cases, so they
don't get silently re-broken or re-litigated later.

## Accepted risk: `uuid` <11.1.1 (via `exceljs`)

`npm audit` flags a moderate-severity `uuid` vulnerability (missing buffer
bounds check in `v3`/`v5`/`v6` when an external `buf` is supplied --
[GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)),
pulled in transitively via `exceljs@4.4.0`.

**Deliberately not fixed.** `npm audit fix --force` "fixes" this by
downgrading `exceljs` to `3.4.0` -- a full major-version regression of the
library this app uses for `.xlsx` generation, in exchange for closing a
vulnerability that doesn't apply to how `exceljs` actually uses `uuid`:

```
$ grep -rn "require('uuid')" node_modules/exceljs/lib/
lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js:const {v4: uuidv4} = require('uuid');
```

`exceljs` only calls `uuid.v4()`, with no `buf` argument, anywhere in its
source. The flagged CVE is specific to `v3`/`v5`/`v6` *when a caller
supplies an external buffer* -- `v4()` isn't affected, and nothing in
`exceljs` passes a buffer at all. Downgrading a major version to silence
a warning about a code path that isn't exercised is pure regression risk
for zero real benefit.

**Revisit if:** a future `exceljs` release bumps its own `uuid`
dependency past `11.1.0` (check `npm view exceljs@latest dependencies`),
or if `exceljs`'s usage of `uuid` changes to call `v3`/`v5`/`v6` with a
supplied buffer (re-grep the above path).

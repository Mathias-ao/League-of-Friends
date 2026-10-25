// Package the single canonical schema with Functions; never maintain a second schema.
import {copyFileSync,mkdirSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
mkdirSync(new URL('functions/lib/domain/',root),{recursive:true});
copyFileSync(new URL('contracts/social-v1/shared.schema.json',root),new URL('functions/lib/domain/socialV1.schema.json',root));

mkdirSync(new URL('functions/lib/integration/',root),{recursive:true});
copyFileSync(new URL('replay-tools/int_c1_wiring_test.json',root),new URL('functions/lib/integration/intC1WiringTest.json',root));

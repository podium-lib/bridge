import fs from 'node:fs';
import path from 'node:path';

let podium = path.join(process.cwd(), 'types', 'global.d.ts');
let module = path.join(process.cwd(), 'types', 'bridge.d.ts');

fs.writeFileSync(
	module,
	`${fs.readFileSync(podium, 'utf-8')}
${fs.readFileSync(module, 'utf-8')}`,
	'utf-8',
);

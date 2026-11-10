// Work around Expo native template copy failures on Windows.
// Extract only the requested native directory, without touching app sources.
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const platform=process.argv[2];
if(!['android','ios'].includes(platform))throw Error('Expected android or ios');
const cwd=fileURLToPath(new URL('.',import.meta.url));
if(process.platform==='win32'&&!existsSync(new URL(`./${platform}`,import.meta.url))){
 const result=spawnSync('tar',['-xzf','node_modules/expo/template.tgz','-C','.', '--strip-components=1',`package/${platform}`],{cwd,stdio:'inherit'});
 if(result.status!==0)throw Error('Native template extraction failed; ensure tar is installed');
}

import { print } from "utils"
import { open } from "https://deno.land/x/open/index.ts";
import axiod from "https://deno.land/x/axiod/mod.ts";
import express, { Express, json } from "npm:express"
import bodyParser from "npm:body-parser"
import { recursiveReaddir } from "https://deno.land/x/recursive_readdir/mod.ts";
import exec from "./app.exec.ts"
import * as semver from "semver"
import {
  decompress
} from "https://deno.land/x/zip@v1.2.3/mod.ts";

const username = 'user';
const password = 'password';

const app: Express = express()
const port = 5001
const router = express.Router()

const teaXyzDir = `${Deno.env.get("HOME")}/.tea/tea.xyz`;
const guiDir = `${teaXyzDir}/tmp/gui`;

app.use(json())
app.use(bodyParser.json({ type: "application/*+json" }));

app.use('/', express.static(guiDir))



router.get('/packages', async (req: Request, res: Response) => {
  const [
    packages,
    installedPackages,
  ] = await Promise.all([
    getApi('/packages'),
    getInstalledPackages(),
  ])

  const pkgs = packages.map((pkg: any) => {
		const found = installedPackages.find((p:any) => p.full_name === pkg.full_name);

		return {
			...pkg,
			state: found ? 'INSTALLED' : 'AVAILABLE',
			installed_version: found ? found.version : ''
		};
	});
  
  res.json(pkgs);
});

router.get('/featured-packages', async (req: Request, res: Response) => {
  return []
})

router.get('/packages/:full_name', async (req: Request, res: Response) => {

  return {}
})

router.get('/packages/:full_name/reviews', async (req: Request, res: Response) => {

  return {}
})

router.post('/packages/install', async (req: Request, res: Response) => {

  // { args: [ "true" ], pkgs: [ { project: "stedolan.github.io/jq", constraint: * } ] }
  const args = {
    args: ["true"],
    pkgs: [{
      project: req?.body?.full_name || "",
      constraint: new semver.Range('*')
    }]
  }

  await exec(args)
  res.json({ success: true });
})

app.use('/api', router);

export default async function gui() {
  try {
    await Deno.open(`${guiDir}/index.html`);
    console.log('maybe detect version if needs updating');
  } catch(e) {
    const __dirname = new URL('.', import.meta.url).pathname;
    console.log(__dirname);
    await decompress(`${__dirname}../gui.zip`, guiDir);
    console.log('initialized gui');
  }

  app.listen(port, () => {
    print(`tea gui running on localhost:${port}`)
    open(`http://localhost:${port}`);
  })
}

async function getApi(path: string) {
  const base = `https://${username}:${password}@api.tea.xyz/v1`;
  const url = join(base, path);
  console.log('url:', url);
  const res = await axiod.get(url);
  return res.data;
}

const join = function (...paths: string[]) {
	return paths
		.map(function (path) {
			if (path[0] === '/') {
				path = path.slice(1);
			}
			if (path[path.length - 1] === '/') {
				path = path.slice(0, path.length - 1);
			}
			return path;
		})
		.join('/');
};

async function getInstalledPackages() {
  const srcDir = `${teaXyzDir}/var/www/`;
  const entries = await recursiveReaddir(srcDir);

	const packages = entries
    .map((path) => path.replace(srcDir, ""))
		.filter((path: string) => path.match('^(.*).(g|x)z$'))
		.map((path:string) => {
			const [pkg_version] = (path || '').split('+')
			const version = pkg_version.split('-').pop()
			const full_name = pkg_version.replace(`-${version}`, '')
			return {
				full_name,
				version
			}
		})
  return packages
}

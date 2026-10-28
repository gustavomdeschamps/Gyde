// Gera pacotes/extensao-vscode/gyde.vsix (o pacote que o VS Code instala) sem precisar do vsce.
// Uso: npm run empacotar -w gyde (ou node pacotes/extensao-vscode/empacotar.mjs)
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';

const root = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const xml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const files = {};
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(root, full).replaceAll('\\', '/');
    if (rel.endsWith('.vsix') || rel === 'empacotar.mjs' || rel === 'node_modules') continue; // só desenvolvimento
    if (statSync(full).isDirectory()) walk(full);
    else files[`extension/${rel}`] = readFileSync(full);
  }
})(root);

const types = { '.json': 'application/json', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/markdown', '.vsixmanifest': 'text/xml' };
files['[Content_Types].xml'] = strToU8(`<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${Object.entries(types).map(([ext, t]) => `<Default Extension="${ext}" ContentType="${t}"/>`).join('')}</Types>`);
files['extension.vsixmanifest'] = strToU8(`<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${xml(pkg.name)}" Version="${xml(pkg.version)}" Publisher="${xml(pkg.publisher)}" />
    <DisplayName>${xml(pkg.displayName)}</DisplayName>
    <Description xml:space="preserve">${xml(pkg.description)}</Description>
    <Tags></Tags>
    <Categories>${xml(pkg.categories.join(','))}</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${xml(pkg.engines.vscode)}" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace" />
      <Property Id="Microsoft.VisualStudio.Code.LocalizedLanguages" Value="" />
    </Properties>
    <Icon>extension/${xml(pkg.icon)}</Icon>
  </Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code" /></Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/${xml(pkg.icon)}" Addressable="true" />
  </Assets>
</PackageManifest>`);

const out = path.join(root, 'gyde.vsix');
writeFileSync(out, zipSync(files, { level: 9 }));
console.log(`Pacote criado: ${out}`);

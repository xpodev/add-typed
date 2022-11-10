#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import { exec, execSync } from 'child_process';

import * as colors from './colors';

import type { IncomingMessage } from 'http';
import type { AnyObject, Package } from './types';
import * as terminal from './args-parser';
terminal.config();

function npmOrYarn() {
    try {
        execSync('yarn --version', { stdio: 'ignore' });
        return 'yarn';
    } catch (e) {
        try {
            execSync('npm --version', { stdio: 'ignore' });
            return 'npm';
        } catch (e) {
            throw new Error('Neither yarn nor npm are installed');
        }
    }
}

const packageManager = npmOrYarn();

// Change to production
const isProduction = (terminal.args.parsed.prod || terminal.args.parsed.production) && true;

const packageSyntax = [
    packageManager,
    packageManager === 'npm' ? 'install' : 'add',
    '', // Package name
    '', // Dev
    terminal.args.raw
];

function httpsRequest(options: https.RequestOptions | string | URL): Promise<IncomingMessage>;
function httpsRequest(url: string | URL, options: https.RequestOptions): Promise<IncomingMessage>;
function httpsRequest(url: https.RequestOptions | string | URL, options?: https.RequestOptions) {
    if (typeof url === 'string') {
        return new Promise<IncomingMessage>((resolve, reject) => {
            https.request(url, options, (res) => {
                resolve(res);
            }).on('error', (err) => {
                reject(err);
            }).end();
        });
    } else {
        return new Promise<IncomingMessage>((resolve, reject) => {
            https.request(url, (res) => {
                resolve(res);
            }).on('error', (err) => {
                reject(err);
            }).end();
        });
    }

}

async function packageExists(name: string, version?: string) {
    version = version && version.match(/([\d+.?]+)/g)?.[0];
    const url = `https://registry.${packageManager === 'yarn' ? 'yarnpkg.com' : 'npmjs.org'}/${name}${version ? `/${version}` : ''}`;
    return (await httpsRequest(url, { method: 'HEAD' })).statusCode === 200;
}

function readPackageJson() {
    if (fs.existsSync('package.json')) {
        return JSON.parse(fs.readFileSync('package.json', 'utf8'));
    }
}

function terminalSpinner() {
    let i = 1;
    const spinnerChars = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.split('').map(char => char + ' ');
    const bis = '\b'.repeat(spinnerChars[0].length);
    process.stdout.write(`${spinnerChars[0].style(colors.FgBlue, colors.Bright)}`);
    const interval = setInterval(() => {
        process.stdout.write(`${bis}${spinnerChars[i].style(colors.FgBlue, colors.Bright)}`);
        i = (i + 1) % spinnerChars.length;
    }, 100);
    return {
        stop: () => {
            clearInterval(interval);
            process.stdout.write(bis);
        }
    };
}

function splitObject(obj: AnyObject) {
    const result: AnyObject[] = [];
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            result.push({ [key]: obj[key] });
        }
    }
    return result;
}

function installPackage(packageName: string, version?: string, dev = false) {
    return new Promise<boolean>((resolve, _reject) => {
        packageSyntax[2] = `${packageName}${version ? `@${version}` : ''}`;
        packageSyntax[3] = (dev ? (packageManager === 'npm' ? '--save-dev' : '--dev') : '');
        const currentCmd = packageSyntax.join(' ');
        process.stdout.write(`> ${currentCmd} `);
        const spinner = terminalSpinner();

        const currentProcess = exec(currentCmd);

        let stderr = '';

        currentProcess.stderr.on('data', (data) => {
            stderr += data;
        });

        currentProcess.on('exit', async (code, signal) => {
            spinner.stop();

            if (signal == 'SIGINT') {
                console.log('\n');
                console.log('Aborted'.style(colors.FgRed, colors.Bright));
                process.exit(code);
            }

            if (code === 0) {
                process.stdout.write('\u2713\n'.style(colors.FgGreen, colors.Bright));
                resolve(true);
            } else {
                process.stdout.write('\u2717\n'.style(colors.FgRed, colors.Bright));
                console.error(stderr.style(colors.FgRed));
                process.exit(code);
            }
        });
    });
}

async function installTypes(packageName: string, version?: string) {
    if (packageName.startsWith('@types/')) {
        return;
    }

    if (packageName.startsWith('@')) {
        packageName = packageName.substring(1).split('/').join('__');
    }

    const typesName = `@types/${packageName}`;
    if ((await packageExists(typesName, version))) {
        return installPackage(typesName, version, true);
    } else {
        console.log(`The types package for ${packageName}${version ? `@${version}` : ''} does not exist, skipping`.style(colors.FgYellow));
    }
}

async function install() {
    const dependencies: Package[] = [];
    const devDependencies: Package[] = [];
    if (terminal.commands.length == 0) {
        const packageJson = readPackageJson();
        if (!packageJson) {
            console.error('Could not find package.json'.style(colors.FgRed, colors.Bright));
            return;
        }

        dependencies.push(...splitObject(packageJson.dependencies ?? {}));
        if (!isProduction) {
            devDependencies.push(...splitObject(packageJson.devDependencies ?? {}));
        }

    } else {
        const packageParts = /^(?<fullName>(@(?<scope>.+)\/)?(?<name>[a-z0-9][.\-_a-z0-9]*))(?:@(?<version>[~^]?(?:[\dvx*]+(?:[-.](?:[\dx*]+|alpha|beta))*)))?/g;
        // const packageAndVersionRegex = /(?<package>(?:@[a-zA-Z][a-zA-Z0-9]+\/[a-zA-Z][a-zA-Z0-9.]+)|[a-zA-Z][a-zA-Z0-9.]+)(?:@(?<version>.*))?/g;
        dependencies.push(...terminal.commands.map(command => {
            const { groups } = packageParts.exec(command);
            return { [groups.fullName]: groups.version ?? '' };
        }));
    }

    for (const dependency of dependencies) {
        const [packageName, version] = Object.entries(dependency)[0];
        await installPackage(packageName, version) && await installTypes(packageName, version);
    }

    for (const dependency of devDependencies) {
        const [packageName, version] = Object.entries(dependency)[0];
        await installPackage(packageName, version, true) && await installTypes(packageName, version);
    }
}

install();
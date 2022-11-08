# Add Typed

If you're tired of installing a package and then installing the types for the package in a separate command, this is for you.

## Installation
npm
```
npm i addt -g
```
 
yarn
```
yarn global add addt
```

## Usage
Installing package[s] with types
```
addt <package_name> [...<package_name>]
```
Installing all packages in package.json with their types (see https://github.com/xpodev/add-typed/issues/1)
```
addt
```
Also works with `npx`
```
npx addt <package_name> [...<package_name>]
```

### Arguments
The tool will pass any argument starts with `-` to the `npm` / `yarn` command, so make sure you use the correct arguments
#### Example
```
addt typescript --save-dev
```
Will be resolved to
```
npm install typescript --save-dev
```
or in yarn (which will cause a failure because `--save-dev` is not valid in yarn)
```
yarn add typescript --save-dev
```

## Notes
- If a package does not have type declarations under the `@types` namespace the types installation will be skipped. 
